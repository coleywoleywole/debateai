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
import Anthropic from "@anthropic-ai/sdk";

const log = logger.scope('debate');

const anthropic = new Anthropic({
  baseURL: "https://anthropic.helicone.ai",
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  },
});

// 20 messages per minute per user (calls Claude API — expensive)
const userLimiter = createRateLimiter({ maxRequests: 20, windowMs: 60_000 });
// 60 per minute per IP as a broader safety net
const ipLimiter = createRateLimiter({ maxRequests: 60, windowMs: 60_000 });

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

    // Per-user rate limit (protects Claude API costs)
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
    const existingDebate = debateId ? await d1.getDebate(debateId) : { success: false };
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
      promptVariant: assignedVariant, // Log the assigned variant
    });
    
    // Deduplicate debate creation: if no debateId and same user+topic within 30s, reuse existing
    if (!debateId) {
      const dup = await d1.findRecentDuplicate(userId, topic, 30);
      if (dup.found && dup.debateId) {
        // Return the existing debate ID so the client uses it instead of creating a duplicate
        return NextResponse.json({
          deduplicated: true,
          debateId: dup.debateId,
          message: "A debate on this topic was just created. Resuming that debate.",
        });
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

    // Build conversation history for Anthropic SDK format
    const messages: Anthropic.MessageParam[] = [];

    // Add previous messages if they exist
    if (previousMessages && previousMessages.length > 0) {
      for (const msg of previousMessages) {
        // Skip empty messages - Anthropic API requires non-empty content
        if (!msg.content || msg.content.trim() === "") continue;

        if (msg.role === "user") {
          messages.push({ role: "user", content: msg.content });
        } else if (msg.role === "ai") {
          messages.push({ role: "assistant", content: msg.content });
        }
      }
    }

    // Add the current user argument
    messages.push({ role: "user", content: userArgument });

    // Inject reminder about citations and brevity to prime the model
    messages.push({
      role: "assistant",
      content:
        "I'll respond with a short, punchy counter (under 120 words). If I search the web, I'll include [1], [2] markers for any facts I cite.",
    });
    messages.push({
      role: "user",
      content: "Go ahead. Keep it short.",
    });

    // Always use streaming response
    const encoder = new TextEncoder();
    // eslint-disable-next-line prefer-const
    let controllerClosed = false; // Track if controller is closed

    const streamResponse = new ReadableStream({
      async start(controller) {
        try {
          // Send initial message
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "start" })}\n\n`)
          );

          // Use Anthropic directly with web search tool
          const stream = anthropic.messages.stream({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 500,
            system: systemPrompt,
            messages: messages,
            tools: [
              {
                type: "web_search_20250305",
                name: "web_search",
                max_uses: 2, // Allow 2 searches for better citations
              },
            ],
          }, {
            headers: {
              "Helicone-User-Id": userId,
              "Helicone-RateLimit-Policy": "100;w=86400;s=user", // 100 requests/day per user
            },
          });

          let accumulatedContent = "";
          let buffer = "";
          let lastFlushTime = Date.now();
          const BUFFER_TIME = 20; // Reduced to 20ms for faster streaming
          const BUFFER_SIZE = 8; // Send 8 characters at a time for better speed
          const citations: any[] = [];
          let citationCounter = 1;
          let searchIndicatorSent = false;

          // Simple flush function for character streaming
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

          // Handle Anthropic streaming events
          stream.on("text", (text) => {
            accumulatedContent += text;

            // Add characters to buffer one by one
            for (const char of text) {
              buffer += char;

              // Flush small chunks frequently
              const now = Date.now();
              if (
                buffer.length >= BUFFER_SIZE ||
                (now - lastFlushTime >= BUFFER_TIME && buffer.length > 0)
              ) {
                flushBuffer();
              }
            }
          });

          // Handle content block events for web search
          (stream as any).on("contentBlockStart", (event: any) => {
            console.log("📚 [ANTHROPIC] Content block start:", JSON.stringify(event, null, 2));
            if (event.content_block?.type === "server_tool_use" && event.content_block?.name === "web_search") {
              if (!searchIndicatorSent) {
                searchIndicatorSent = true;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "search_start",
                    })}\n\n`
                  )
                );
              }
            }
          });

          // Handle the full message to extract citations
          const finalMessage = await stream.finalMessage();
          console.log("📚 [ANTHROPIC] Final message content blocks:", finalMessage.content.length);

          // Extract citations from the response
          const MAX_CITATIONS = 5;
          const seenUrls = new Set<string>();

          // First pass: extract from text block citations (preferred - has proper mapping)
          for (const block of finalMessage.content) {
            if (block.type === "text") {
              // Cast to access citations property (added by web search, not in base type)
              const textBlock = block as typeof block & {
                citations?: Array<{
                  type: string;
                  url: string;
                  title?: string;
                  cited_text?: string;
                }>;
              };

              if (textBlock.citations && Array.isArray(textBlock.citations)) {
                console.log("📚 [CITATIONS] Found text block with", textBlock.citations.length, "citations");
                for (const citation of textBlock.citations) {
                  if (citations.length >= MAX_CITATIONS) break;
                  if (citation.type === "web_search_result_location" && citation.url) {
                    // Deduplicate by URL
                    if (!seenUrls.has(citation.url)) {
                      seenUrls.add(citation.url);
                      const citationData = {
                        id: citationCounter++,
                        url: citation.url,
                        title: citation.title || new URL(citation.url).hostname,
                      };
                      citations.push(citationData);
                      console.log("📚 [CITATIONS] Added citation:", citationData);
                    }
                  }
                }
              }
            }
            if (citations.length >= MAX_CITATIONS) break;
          }

          // Fallback: if no citations found in text blocks, extract from web_search_tool_result
          if (citations.length === 0) {
            console.log("📚 [CITATIONS] No citations in text blocks, checking web_search_tool_result");
            for (const block of finalMessage.content) {
              if (block.type === "web_search_tool_result") {
                const resultBlock = block as typeof block & {
                  content?: Array<{
                    type: string;
                    url?: string;
                    title?: string;
                  }>;
                };
                if (resultBlock.content && Array.isArray(resultBlock.content)) {
                  console.log("📚 [CITATIONS] Found web_search_tool_result with", resultBlock.content.length, "results");
                  for (const result of resultBlock.content) {
                    if (citations.length >= MAX_CITATIONS) break;
                    if (result.type === "web_search_result" && result.url) {
                      if (!seenUrls.has(result.url)) {
                        seenUrls.add(result.url);
                        const citationData = {
                          id: citationCounter++,
                          url: result.url,
                          title: result.title || new URL(result.url).hostname,
                        };
                        citations.push(citationData);
                        console.log("📚 [CITATIONS] Added fallback citation:", citationData);
                      }
                    }
                  }
                }
              }
              if (citations.length >= MAX_CITATIONS) break;
            }
          }

          console.log("📚 [CITATIONS] Total extracted:", citations.length);

          // Send citations if any
          if (citations.length > 0 && !controllerClosed) {
            console.log("📚 [CITATIONS] Sending to frontend. Total citations:", citations.length);
            flushBuffer(); // Flush any pending content first
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "citations",
                  citations: citations,
                })}\n\n`
              )
            );
          }

          // Flush any remaining buffer
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
          }

          // Save the complete debate turn - fetch existing debate, add messages, and save
          if (debateId && accumulatedContent) {
            const existingDebate = await d1.getDebate(debateId);
            if (existingDebate.success && existingDebate.debate) {
              const existingMessages = Array.isArray(
                existingDebate.debate.messages
              )
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
                topic: (existingDebate.debate.topic as string) || topic, // Preserve original topic
                messages: existingMessages,
                debateId,
                opponentStyle,
                promptVariant: assignedVariant,
              });
            }
          }

          // Send completion message
          if (!controllerClosed) {
            console.log('📚 [CITATIONS] Stream complete. Final citations count:', citations.length);
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
            // Send [DONE] signal to ensure frontend knows streaming is complete
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
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
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
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
