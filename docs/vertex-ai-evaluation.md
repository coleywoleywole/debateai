# Vertex AI (Gemini 2.5 Flash) Evaluation

**Date:** 2026-02-10
**Author:** Forge
**Status:** Research spike — recommendation for Cole/Atlas

---

## Current Stack: Claude Haiku 4.5

| Metric | Value |
|--------|-------|
| Model | `claude-haiku-4-5-20251001` |
| Input pricing | $1.00 / 1M tokens |
| Output pricing | $5.00 / 1M tokens |
| Web search | Built-in `web_search_20250305` tool (included in API cost) |
| Routing | Via Helicone proxy for analytics |
| Latency | ~1-2s TTFB, good streaming |

## Candidate: Gemini 2.5 Flash (Vertex AI)

| Metric | Value |
|--------|-------|
| Model | `gemini-2.5-flash` |
| Input pricing | $0.30 / 1M tokens |
| Output pricing | $2.50 / 1M tokens (includes reasoning) |
| Web search | Grounding with Google Search: 5K free/month, then $14/1K queries |
| Context window | 1M tokens |
| Latency | Comparable to Haiku for short outputs |

### Budget Option: Gemini 2.5 Flash Lite

| Metric | Value |
|--------|-------|
| Input pricing | $0.10 / 1M tokens |
| Output pricing | $0.40 / 1M tokens |
| Tradeoff | Slightly less capable, no native grounding |

---

## Cost Comparison (per 1M debate turns)

Assumptions: ~800 input tokens, ~200 output tokens per turn (after shortening).

| Provider | Input Cost | Output Cost | Search Cost | Total / 1M turns |
|----------|-----------|-------------|-------------|-------------------|
| Claude Haiku 4.5 | $0.80 | $1.00 | $0 (included) | **$1.80** |
| Gemini 2.5 Flash | $0.24 | $0.50 | ~$7* | **$0.74 + search** |
| Gemini 2.5 Flash Lite | $0.08 | $0.08 | N/A | **$0.16** |

*Search cost: assuming 50% of turns trigger search, 5K free/month, ~$14/1K after that.

### Key finding: **70% input cost savings, 50% output cost savings** with Gemini 2.5 Flash.
With Flash Lite (no search): **91% total cost savings**.

---

## Pros

1. **Significant cost savings** — 60-90% depending on model
2. **Cole has existing credits** — immediate savings
3. **Google Search grounding** — native integration, potentially better citations than Claude's web search tool
4. **1M token context** — no practical limit
5. **Flash Lite** as a budget fallback for simple topics

## Cons

1. **Migration effort** — Need to swap Anthropic SDK for Vertex AI SDK
   - Streaming API is different
   - Citation format differs (grounding metadata vs inline markers)
   - System prompt handling differs
2. **Search quality unknown** — Google Grounding may return different quality results than Claude's web search
3. **Helicone integration** — Currently routes through Helicone for analytics; would need new integration or alternative
4. **Persona adherence** — Haiku is well-tuned for our persona-based prompts; Gemini may need prompt re-tuning
5. **Grounding cost at scale** — $14/1K queries could add up if most turns trigger search (but 5K free/month covers early stage)
6. **Reasoning tokens billed** — Gemini 2.5 Flash output pricing includes "thinking" tokens, which may inflate cost unpredictably

---

## Recommendation

### Phase 1 (Now): Prompt shortening ✅
Already shipping — reduces token usage ~50% regardless of provider. Benefits both current and future stack.

### Phase 2 (Next sprint): A/B test with Gemini
1. Add provider abstraction layer (strategy pattern)
2. Route 10% of debates to Gemini 2.5 Flash
3. Compare: response quality, latency, citation quality, cost
4. Measure user engagement (messages per debate, completion rate)

### Phase 3 (If A/B positive): Full migration
1. Swap default provider to Gemini
2. Keep Claude as fallback
3. Migrate Helicone analytics to Vertex AI monitoring

### Not recommended: Flash Lite for debates
Too cheap = too dumb for persona work. Save for potential scoring/summarization use.

---

## Implementation Notes

### Vertex AI SDK swap
```typescript
// Current (Anthropic)
import Anthropic from '@anthropic-ai/sdk';
const stream = anthropic.messages.stream({ model: 'claude-haiku-4-5-20251001', ... });

// Vertex AI equivalent
import { VertexAI } from '@google-cloud/vertexai';
const vertex = new VertexAI({ project: 'PROJECT_ID', location: 'us-central1' });
const model = vertex.getGenerativeModel({ model: 'gemini-2.5-flash' });
const stream = await model.generateContentStream({ contents: [...] });
```

### Grounding configuration
```typescript
// Enable Google Search grounding
const model = vertex.getGenerativeModel({
  model: 'gemini-2.5-flash',
  tools: [{ googleSearch: { dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC' } } }],
});
```

### Environment variables needed
- `GOOGLE_CLOUD_PROJECT` — GCP project ID
- `GOOGLE_APPLICATION_CREDENTIALS` — Service account key path (or use Vercel's GCP integration)

---

## Decision needed from Cole/Atlas
1. **Go/no-go on Phase 2** (A/B test)
2. **GCP project ID + service account** for Vertex AI access
3. **Helicone replacement** — do we keep it, or move to Vertex AI's built-in monitoring?
