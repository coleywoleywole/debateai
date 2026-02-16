---
title: How We Built Real-Time AI Debates with Claude
description: >-
  A deep dive into the architecture behind DebateAI — streaming AI responses,
  persona-driven debate opponents, live web search citations, and the
  infrastructure choices that make it all work.
date: '2026-02-04'
author: DebateAI Engineering
tags:
  - engineering
  - ai
  - streaming
  - claude
  - architecture
  - next.js
image: /blog/how-we-built-realtime-ai-debates.png
published: true
---


When we set out to build DebateAI, we had a deceptively simple idea: let people argue with AI opponents in real time. Pick a topic, choose a persona (Socrates, George Carlin, a Devil's Advocate), and go back and forth until someone concedes — or runs out of arguments.

Simple to describe. Not simple to build.

The core challenge is that debate feels fundamentally different from chatbot Q&A. A debate opponent needs to *actively disagree with you*, cite real sources to support its position, stream responses fast enough that it feels like a live back-and-forth, and do all of this while staying in character as a 5th-century philosopher or a modern comedian.

Here's how we built it.

## The Architecture at a Glance

DebateAI runs on a straightforward but carefully tuned stack:

- **Next.js 15** (App Router) on **Vercel** — server components for SEO, API routes for debate logic
- **Claude claude-sonnet-4-20250514** via the Anthropic SDK — the debate engine
- **Cloudflare D1** (SQLite over REST) — debate storage, user data, leaderboards
- **Clerk** — authentication
- **Stripe** — subscriptions for premium features

The interesting bits are in how these pieces connect, especially the real-time streaming layer.

## Streaming: Making AI Feel Conversational

The single most important UX decision we made was character-level streaming. When your AI opponent responds, you don't wait 3-5 seconds for a complete response — you see text appearing in real time, like watching someone type.

We use Server-Sent Events (SSE) rather than WebSockets. SSE is simpler, works through CDNs without special configuration, and fits naturally with the request-response model of serverless functions. Here's the simplified flow:

```typescript
// API route creates a ReadableStream
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();

    // Start the Claude stream
    const response = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: systemPrompt,
      messages: conversationHistory,
      tools: [{
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 1,
      }],
    });

    let buffer = "";

    response.on("text", (text) => {
      buffer += text;

      // Flush every 8 characters or 20ms — whichever comes first
      if (buffer.length >= 8 || timeSinceLastFlush >= 20) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: buffer })}\n\n`)
        );
        buffer = "";
      }
    });
  },
});
```

Two numbers matter here: **buffer size of 8 characters** and **flush interval of 20ms**. We arrived at these through testing. Too small (1-2 chars) and the overhead of JSON-encoding each chunk dominates. Too large (50+ chars) and the response feels laggy, like watching a progress bar instead of a conversation. Eight characters at 20ms intervals hits the sweet spot — fast enough to feel live, efficient enough to not drown the browser in events.

## The Persona System

Every debate in DebateAI is driven by a persona — the character your AI opponent embodies. This could be a historical figure (Socrates, Marcus Aurelius), a public intellectual (Noam Chomsky, Sam Harris), a comedian (George Carlin, Ricky Gervais), or even a fictional character (Tyrion Lannister, Sherlock Holmes).

The persona system works through a carefully structured system prompt. The critical constraint is in the `<core_rule>` block:

```
You must ALWAYS argue AGAINST the user's position:
- If they argue FOR something, you argue AGAINST it
- If they argue AGAINST something, you argue FOR it
- Challenge their evidence and reasoning
- Take the opposing stance to create a real debate
```

This seems obvious, but it's the hardest part to get right. Language models are trained to be helpful — they *want* to agree with you. Without explicit, strongly-worded opposition instructions, Claude will gradually drift toward validating the user's arguments instead of challenging them. We position the opposition rule before the persona instructions because prompt ordering matters: the model weighs earlier instructions more heavily.

The persona layer then wraps around this opposition core:

```
Adopt the style of ${persona}:
- Use their speaking style, vocabulary, and mannerisms
- Reference their known views where relevant
- Use their characteristic phrases or expressions
- BUT always argue AGAINST the user's position,
  even if the real ${persona} might agree
```

That last line is key. If you're debating climate policy with a Greta Thunberg persona and you argue *for* aggressive climate action, the AI needs to push back — even though the real Greta would agree with you. The debate mechanic takes priority over persona accuracy. Users come to argue, not to have their views echoed back in a Swedish accent.

## Live Web Search: Grounded Arguments

One of our favorite features is live citation. When the AI opponent makes a factual claim, it can search the web in real time and cite actual sources — with clickable links rendered inline.

We use Claude's built-in web search tool, limited to one search per response to control costs and latency:

```typescript
tools: [{
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 1,
}]
```

When Claude decides to search, the streaming flow gets more complex. We detect the search starting via content block events and send a `search_start` event to the frontend, which shows a subtle "Searching..." indicator. Citations arrive as structured data attached to text blocks, and we extract, deduplicate, and cap them at three per response.

The citation pipeline has a two-pass extraction: first from inline text citations (which have proper source mapping), then falling back to the raw search results if no inline citations are found. This handles the various ways Claude structures its search-augmented responses.

The result: your AI opponent doesn't just assert things — it backs them up with real, current sources. It makes debates feel more substantive and gives users something to actually click through and verify.

## Why Cloudflare D1 (and Not Postgres)

We needed a database that could store debate transcripts (variable-length JSON arrays of messages), user metadata, and subscription state. We chose Cloudflare D1 — SQLite accessed over a REST API — for a few reasons:

**Cost.** D1 is effectively free at our scale. We're storing structured data (debates, users, leaderboard entries), not blobs. SQLite handles JSON fields natively, and the REST API means zero connection pooling headaches on Vercel's serverless platform.

**Simplicity.** No connection strings to manage, no PgBouncer, no cold-start connection issues. Every database call is an HTTP request with an API token. The trade-off is latency (~50-100ms per query vs. ~5ms with a local Postgres connection), but for our use case — saving debate turns and reading history — that's fine.

**Schema flexibility.** Debates store their message history as a JSON text column. This is an anti-pattern in traditional relational databases but works well in SQLite where JSON functions are first-class. We can query message counts with `json_array_length(messages)` without deserializing the full array.

The main downside: no real-time subscriptions or change feeds. If we ever need live multiplayer debates, we'd need to layer something like Cloudflare Durable Objects or a proper WebSocket backend on top.

## The AI Takeover Feature

One of our most-used features lets the AI write *your* argument for you. Stuck on how to respond? Hit the takeover button and an AI generates an argument from your position.

This is architecturally interesting because it uses a *different* model path. The main debate flow uses Claude directly via the Anthropic SDK. The takeover feature routes through an OpenAI-compatible API (via Helicone's gateway) to access Claude with web search through a different integration path.

The takeover prompt is also fundamentally different — instead of opposing the user, it needs to *champion* the user's position while countering the opponent's last argument. We extract the user's previous arguments to understand their stance, then instruct the model to continue that line of reasoning.

We deliberately stream the takeover response slower (50ms intervals, 5-character chunks) than the opponent's response (20ms, 8 characters). This creates a subtle UX signal: the AI opponent responds quickly and assertively, while the AI-assisted user response appears more measured and thoughtful. Small detail, but it reinforces the feeling that these are two different "voices" in the debate.

## Rate Limiting Without Infrastructure

Running an AI debate platform means every user interaction triggers an expensive API call — Claude isn't free. We needed rate limiting, but didn't want to add Redis or any external state.

Our solution: in-memory rate limiters directly in the API routes.

```typescript
const userLimiter = createRateLimiter({ maxRequests: 20, windowMs: 60_000 });
const ipLimiter = createRateLimiter({ maxRequests: 60, windowMs: 60_000 });
```

Each limiter maintains a `Map` of keys to request counts with periodic cleanup. On Vercel's serverless platform, each function instance has its own memory — so these limiters protect against single-source abuse (one user hammering the API) but not distributed attacks. For that, we'd need Vercel's WAF or Cloudflare's rate limiting.

The key design choice: **IP check runs before authentication, user check runs after.** Authentication is expensive (Clerk session validation), so we reject obvious abuse at the IP level first. Then for authenticated users, we enforce per-user limits to prevent any single account from consuming disproportionate resources.

## Server Components for SEO

Debate pages have a dual audience: users who interact with the debate, and search engine crawlers who need to index the content. We solved this with Next.js server components.

The debate page (`/debate/[debateId]`) is a server component that:
1. Fetches the debate from D1 at request time
2. Renders semantic HTML with the full conversation (hidden visually, accessible to crawlers)
3. Injects JSON-LD structured data (DiscussionForumPosting schema)
4. Sets dynamic OG meta tags (title includes the topic, image shows the score)
5. Passes the data to a client component that handles the interactive UI

This means Google sees a fully-rendered debate page with structured data, while users get the rich interactive experience. The trade-off is that every debate page request hits D1 — but with Vercel's edge caching and D1's low latency, time-to-first-byte stays under 500ms.

## Lessons Learned

**Cap response length aggressively.** We set `max_tokens: 600` on all debate responses. Early versions allowed longer responses, and the AI would write essay-length arguments that killed the conversational feel. Debates should feel like rapid exchanges, not term papers.

**Personas drift.** Over a long debate (10+ turns), the AI gradually loses its persona voice and reverts to generic "assistant" tone. We haven't fully solved this — longer system prompts help, but there's a tension between persona fidelity and response quality. The 600-token limit actually helps here by keeping individual responses short enough that persona drift doesn't accumulate as fast.

**Error messages are user-facing.** Early on, we were returning raw error messages from Stripe and Cloudflare to the client. A security audit caught this — error responses should be generic ("Something went wrong") while the detailed error goes to server logs. We now have regression tests that scan every API route for error response leaks.

**SSE needs explicit done signals.** Some clients (especially mobile browsers) don't reliably detect stream closure. We added an explicit `data: [DONE]` event at the end of every stream, which the frontend uses as the canonical "response complete" signal rather than relying on the stream closing.

## What's Next

We're working on several improvements: better scoring mechanics (the current system is functional but basic), voice debates using speech-to-text and text-to-speech, multiplayer debates where two humans argue while an AI judges, and a public API so developers can embed debates in their own apps.

The core architecture has held up well. SSE streaming, persona-driven prompts, and the server/client component split give us a solid foundation to build on. The biggest lesson: in AI products, the model is maybe 20% of the work. The other 80% is the infrastructure that makes it feel fast, reliable, and fun.

---

*Want to test your arguments against AI? [Start a debate on DebateAI](https://debateai.org) — pick a topic, choose your opponent, and see how your reasoning holds up.*
