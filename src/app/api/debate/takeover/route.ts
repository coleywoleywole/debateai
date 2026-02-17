import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-helper";
import { d1 } from "@/lib/d1";
import { checkAppDisabled } from "@/lib/app-disabled";
import { getTakeoverPrompt } from "@/lib/prompts";
import { createRateLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { errors, validateBody } from "@/lib/api-errors";
import { takeoverSchema } from "@/lib/api-schemas";
import { generateContentStreamWithFallback } from "@/lib/vertex";

// 10 takeover requests per minute per user
const userLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });
const ipLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });

export async function POST(request: Request) {
  // Check if app is disabled
  const disabledResponse = checkAppDisabled();
  if (disabledResponse) return disabledResponse;

  // IP-based rate limit first
  const ipRl = ipLimiter.check(getClientIp(request));
  if (!ipRl.allowed) {
    return rateLimitResponse(ipRl);
  }

  try {
    const userId = await getUserId();

    if (!userId) {
      return errors.unauthorized();
    }

    // Skip user rate limit for guests (IP limit still applies)
    let userRl;
    if (!userId.startsWith('guest_')) {
      userRl = userLimiter.check(`user:${userId}`);
      if (!userRl.allowed) {
        return rateLimitResponse(userRl);
      }
    }

    // Validate request body
    const { debateId, topic, previousMessages, opponentStyle } = await validateBody(
      request,
      takeoverSchema
    );

    const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";
    const isLocalDev =
      process.env.NODE_ENV === "development" ||
      (process.env.NODE_ENV !== "production" && process.env.LOCAL_DEV_BYPASS === "true");
    if (!isTestMode && !isLocalDev) {
      const messageLimit = await d1.checkDebateMessageLimit(debateId);
      if (!messageLimit.allowed && !messageLimit.isPremium) {
        return errors.messageLimit(messageLimit.count, messageLimit.limit);
      }
    }

    // Build conversation history for context
    const conversationHistory = (previousMessages || [])
      .map((msg) => {
        if (msg.role === "user") {
          return `Human's argument: ${msg.content}`;
        } else if (msg.role === "ai") {
          return `Opponent's argument: ${msg.content}`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");

    const userArguments = (previousMessages || [])
      .filter((msg) => msg.role === "user")
      .map((msg) => msg.content)
      .join(" ");

    const systemPrompt = getTakeoverPrompt(
      topic,
      opponentStyle || "",
      conversationHistory,
      userArguments
    );

    const lastOpponentMessage =
      (previousMessages || []).filter((msg) => msg.role === "ai").pop()
        ?.content || "";

    const userPrompt = lastOpponentMessage
      ? `The opponent just said: "${lastOpponentMessage}"\n\nGenerate my response arguing for my position.`
      : `Generate my opening argument for this debate on "${topic}".`;

    const modelOptions = { systemInstruction: systemPrompt };

    let controllerClosed = false;

    const streamResponse = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const { stream: resultStream } = await generateContentStreamWithFallback(
            "gemini-2.5-flash",
            modelOptions,
            {
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              tools: [{ googleSearch: {} } as any],
            },
          );

          let buffer = "";
          let lastFlushTime = Date.now();
          const BUFFER_TIME = 50;
          const BUFFER_SIZE = 5;
          const citations: { id: number; url: string; title: string }[] = [];
          const seenUrls = new Set<string>();
          let citationCounter = 1;

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
            
            // Handle citations
            const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
            if (groundingMetadata?.groundingChunks) {
              for (const groundChunk of groundingMetadata.groundingChunks) {
                if (groundChunk.web && groundChunk.web.uri) {
                   const url = groundChunk.web.uri;
                   const title = groundChunk.web.title || new URL(url).hostname;
                   
                   if (!seenUrls.has(url)) {
                     seenUrls.add(url);
                     citations.push({
                       id: citationCounter++,
                       url: url,
                       title: title,
                     });
                   }
                }
              }
            }

            buffer += text;
            const now = Date.now();
            if (buffer.length >= BUFFER_SIZE || (now - lastFlushTime >= BUFFER_TIME && buffer.length > 0)) {
              flushBuffer();
            }
          }

          if (citations.length > 0 && !controllerClosed) {
            if (buffer) flushBuffer();
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "citations",
                  citations: citations,
                })}\n\n`
              )
            );
          }

          if (buffer) {
            flushBuffer();
          }

          if (!controllerClosed) {
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          }
        } catch (error) {
          console.error("AI Takeover error:", error);
          if (!controllerClosed) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  error: "Failed to generate AI argument",
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

    return new Response(streamResponse, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error("AI takeover error:", error);
    return errors.internal("Failed to process AI takeover");
  }
}
