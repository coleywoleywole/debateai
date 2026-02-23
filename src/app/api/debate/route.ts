import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-helper";
import { d1 } from "@/lib/d1";
import { getDebatePrompt, getDailyPersona } from "@/lib/prompts";
import { getAggressiveDebatePrompt } from "@/lib/prompts.aggressive";
import { checkAppDisabled } from "@/lib/app-disabled";
import { createRateLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { errors, validateBody } from "@/lib/api-errors";
import { sendMessageSchema, SendMessageInput } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";
import { captureError } from "@/lib/sentry";
import { generateContentStreamWithFallback } from "@/lib/vertex";
import { Content } from "@google-cloud/vertexai";

const log = logger.scope('debate');

// 20 messages per minute per user
const userLimiter = createRateLimiter({ maxRequests: 20, windowMs: 60_000 });
// 10 per minute per IP as a broader safety net
const ipLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });

export async function POST(request: Request) {
  // Check if app is disabled
  const disabledResponse = checkAppDisabled();
  if (disabledResponse) return disabledResponse;

  // IP-based rate limit first (before auth check)
  const ipRl = ipLimiter.check(getClientIp(request));
  if (!ipRl.allowed) return rateLimitResponse(ipRl);

  try {
    const userId = await getUserId();

    if (!userId) {
      return errors.unauthorized();
    }

    // Per-user rate limit
    const userRl = userLimiter.check(`user:${userId}`);
    if (!userRl.allowed) return rateLimitResponse(userRl);

    // Validate request body
    let body: SendMessageInput;
    try {
      body = await validateBody(request, sendMessageSchema);
    } catch (error) {
      if (error instanceof NextResponse) return error;
      return errors.badRequest("Invalid request body");
    }

    const {
      debateId,
      character,
      opponentStyle,
      topic,
      userArgument,
      previousMessages,
      isAIAssisted,
    } = body;

    // Get existing debate state for A/B test variant
    let existingDebate: { success: boolean; debate?: any } = { success: false };
    try {
      existingDebate = debateId ? await d1.getDebate(debateId) : { success: false };
    } catch {
      // D1 unavailable (e.g. local dev) — continue with defaults
    }

    // Ownership check: only the debate owner can send messages
    if (debateId && existingDebate.success && existingDebate.debate && existingDebate.debate.user_id !== userId) {
      return errors.forbidden('You do not own this debate');
    }

    let assignedVariant = 'default';

    if (existingDebate.success && (existingDebate as any).debate?.promptVariant) {
      // 2. Debate exists, use its already-assigned variant
      assignedVariant = (existingDebate as any).debate.promptVariant as string;
    } else {
      // 1. New debate, so assign a variant based on user ID hash
      // Simple deterministic hash: even/odd ASCII value of last char of userId
      const lastChar = userId.slice(-1);
      if (lastChar.charCodeAt(0) % 2 === 0) {
        assignedVariant = 'aggressive';
      }
    }

    log.info('message.received', {
      userId,
      debateId: debateId || 'new',
      topic: topic.slice(0, 100),
      character,
      messageIndex: previousMessages.length,
      isAIAssisted,
      promptVariant: assignedVariant,
    });
    
    // Deduplicate debate creation
    if (!debateId) {
      try {
        const dup = await d1.findRecentDuplicate(userId, topic, 30);
        if (dup.found && dup.debateId) {
          return NextResponse.json({
            deduplicated: true,
            debateId: dup.debateId,
            message: "A debate on this topic was just created. Resuming that debate.",
          });
        }
      } catch {
        // D1 unavailable — skip dedup check
      }
    }

    // Check message limit
    const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";
    const isLocalDev =
      process.env.NODE_ENV === "development" ||
      (process.env.NODE_ENV !== "production" && process.env.LOCAL_DEV_BYPASS === "true");
    if (debateId && !isTestMode && !isLocalDev) {
      const messageLimit = await d1.checkDebateMessageLimit(debateId);
      if (!messageLimit.allowed) {
        log.info('debate.limit_reached', { debateId, variant: assignedVariant });
        return errors.messageLimit(messageLimit.count, messageLimit.limit);
      }
    }

    // A/B Test for Aggressive Persona Spike
    let systemPrompt: string;
    const isFirstResponse = !previousMessages || previousMessages.length === 0;

    if (assignedVariant === 'aggressive') {
      log.info('prompt.variant.used', { variant: 'aggressive', debateId: debateId || 'new' });
      systemPrompt = getAggressiveDebatePrompt(topic, isFirstResponse);
    } else {
      // Default behavior
      const persona = opponentStyle || getDailyPersona();
      systemPrompt = getDebatePrompt(persona, topic, isFirstResponse);
    }

    // Gemini history format
    const history: Content[] = [];

    if (previousMessages && previousMessages.length > 0) {
      for (const msg of previousMessages) {
        if (!msg.content || msg.content.trim() === "") continue;

        if (msg.role === "user") {
          history.push({ role: "user", parts: [{ text: msg.content }] });
        } else if (msg.role === "ai") {
          history.push({ role: "model", parts: [{ text: msg.content }] });
        }
      }
    }

    const modelOptions = {
      systemInstruction: systemPrompt,
      generationConfig: {
        // Limit thinking budget so tokens start streaming faster
        // Without this, Gemini 2.5 Flash "thinks" for seconds before emitting any tokens
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    // Inject reminder about citations
    const userMessage = `${userArgument}\n\n(Remember: Keep it short, under 120 words. If you state facts, verify them with Google Search.)`;

    const encoder = new TextEncoder();
    let controllerClosed = false;

    const streamResponse = new ReadableStream({
      async start(controller) {
        const streamStartTime = Date.now();
        try {
          log.info('stream.start', { debateId, userId });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "start" })}\n\n`)
          );

          const { stream: resultStream, model: usedModel } = await generateContentStreamWithFallback(
            "gemini-2.5-flash",
            modelOptions,
            {
              contents: [...history, { role: "user", parts: [{ text: userMessage }] }],
              tools: [{ googleSearch: {} } as any],
            },
          );
          log.info('stream.model', { debateId, model: usedModel });

          let accumulatedContent = "";
          let buffer = "";
          let lastFlushTime = Date.now();
          const BUFFER_TIME = 20;
          const BUFFER_SIZE = 8;
          const citations: any[] = [];
          const seenUrls = new Set<string>();
          const urlToCitationId = new Map<string, number>();
          let citationCounter = 1;
          let lastGroundingMetadata: any = null;

          const flushBuffer = () => {
            if (buffer && !controllerClosed) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "chunk",
                    content: buffer,
                  })}\n\n`
                )
              );
              buffer = "";
              lastFlushTime = Date.now();
            }
          };

          for await (const chunk of resultStream) {
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";

            // Handle citations/grounding
            const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
            if (groundingMetadata) {
              lastGroundingMetadata = groundingMetadata;
              if (groundingMetadata.groundingChunks) {
                for (const groundChunk of groundingMetadata.groundingChunks) {
                  if (groundChunk.web && groundChunk.web.uri) {
                     const url = groundChunk.web.uri;
                     const title = groundChunk.web.title || new URL(url).hostname;

                     if (!seenUrls.has(url)) {
                       seenUrls.add(url);
                       const citationData = {
                         id: citationCounter++,
                         url: url,
                         title: title,
                       };
                       citations.push(citationData);
                       urlToCitationId.set(url, citationData.id);
                     }
                  }
                }
              }
            }

            accumulatedContent += text;

            for (const char of text) {
              buffer += char;
              const now = Date.now();
              if (buffer.length >= BUFFER_SIZE || (now - lastFlushTime >= BUFFER_TIME && buffer.length > 0)) {
                flushBuffer();
              }
            }
          }

          // Insert inline citation markers using groundingSupports
          if (lastGroundingMetadata?.groundingSupports && citations.length > 0) {
            const chunks = lastGroundingMetadata.groundingChunks || [];
            const supports = lastGroundingMetadata.groundingSupports;

            // Map grounding chunk index → citation id
            const chunkIndexToCitationId = new Map<number, number>();
            for (let i = 0; i < chunks.length; i++) {
              const url = chunks[i]?.web?.uri;
              if (url && urlToCitationId.has(url)) {
                chunkIndexToCitationId.set(i, urlToCitationId.get(url)!);
              }
            }

            // Sort supports by endIndex descending so insertions don't shift earlier indices
            const sortedSupports = [...supports]
              .filter((s: any) => s.segment && typeof s.segment.endIndex === 'number')
              .sort((a: any, b: any) => b.segment.endIndex - a.segment.endIndex);

            let annotated = accumulatedContent;
            const insertedPositions = new Set<number>();

            for (const support of sortedSupports) {
              const endIdx = support.segment.endIndex;
              if (insertedPositions.has(endIdx)) continue;

              const ids = (support.groundingChunkIndices || [])
                .map((idx: number) => chunkIndexToCitationId.get(idx))
                .filter((id: number | undefined): id is number => id !== undefined);

              if (ids.length > 0 && endIdx <= annotated.length) {
                const uniqueIds = [...new Set(ids)];
                const marker = uniqueIds.map(id => `[${id}]`).join('');
                annotated = annotated.slice(0, endIdx) + marker + annotated.slice(endIdx);
                insertedPositions.add(endIdx);
              }
            }

            accumulatedContent = annotated;
          }

          // Send citations if any
          if (citations.length > 0 && !controllerClosed) {
            flushBuffer();
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "citations",
                  citations: citations,
                })}\n\n`
              )
            );
          }

          if (buffer && !controllerClosed) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "chunk",
                  content: buffer,
                })}\n\n`
              )
            );
          }

          // Save the complete debate turn (non-blocking in dev if D1 unavailable)
          if (debateId && accumulatedContent) {
            try {
              const existingDebate = await d1.getDebate(debateId);
              if (existingDebate.success && existingDebate.debate) {
                const existingMessages = Array.isArray(existingDebate.debate.messages)
                  ? existingDebate.debate.messages
                  : [];

                existingMessages.push({
                  role: "user",
                  content: userArgument,
                  ...(isAIAssisted && { aiAssisted: true }),
                });
                existingMessages.push({
                  role: "ai",
                  content: accumulatedContent,
                  ...(citations.length > 0 && { citations }),
                });

                await d1.saveDebate({
                  userId,
                  opponent: character,
                  topic: (existingDebate.debate.topic as string) || topic,
                  messages: existingMessages,
                  debateId,
                  opponentStyle,
                  promptVariant: assignedVariant,
                });
              }
            } catch {
              // D1 unavailable — debate still works, just not persisted
            }
          }

          if (!controllerClosed) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "complete",
                  content: accumulatedContent,
                  debateId: debateId,
                  ...(citations.length > 0 && { citations }),
                })}\n\n`
              )
            );
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            
            log.info('stream.complete', { 
              debateId, 
              durationMs: Date.now() - streamStartTime,
              contentLength: accumulatedContent.length,
              citationCount: citations.length
            });
          }
        } catch (error) {
          log.error('stream.failed', {
            debateId: debateId || 'unknown',
            error: error instanceof Error ? error.message : String(error),
          });
          captureError(error, {
            tags: { route: 'debate', phase: 'streaming' },
            extra: { debateId, topic: topic?.slice(0, 100) },
          });
          if (!controllerClosed) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  error: "Failed to generate response",
                })}\n\n`
              )
            );
          }
        } finally {
          controllerClosed = true;
          controller.close();
        }
      },
    });

    return new NextResponse(streamResponse, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    log.error('api.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    captureError(error, {
      tags: { route: 'debate' },
    });
    return errors.internal("Failed to generate debate response");
  }
}
