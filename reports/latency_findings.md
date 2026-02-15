# API Latency Investigation Findings

**Date:** 2026-02-15

## Hypothesis
The debate completion rate is stuck at 2.7%. One hypothesis is that performance is slow and users are getting bored waiting for messages.

## Methodology
- Ran a synthetic load test against the API endpoint (`/api/debate`) using `scripts/measure_ai_latency.ts`.
- Measured Time to First Byte (TTFB) and Total Generation Time for 10 iterations.
- Bypassed rate limits for testing purposes (in local dev mode).

## Results

| Metric | P50 (Median) | P95 | P99 |
|--------|--------------|-----|-----|
| **TTFB** | ~660ms | ~1.6s | ~1.6s |
| **Total Time** | ~1.2s | ~3.4s | ~3.4s |

## Analysis
- **TTFB is excellent:** Users see the first token (typing indicator/text) within ~600ms on average. This is well within acceptable limits for LLM interactions.
- **Total Time is acceptable:** Full responses complete in under 3.5s in the worst case (P99).
- **Database Latency:** D1 reads average ~250ms, which contributes to the TTFB but is not the bottleneck.
- **Stalled Debates:** Audit showed 0 stalled debates in the last 50, indicating high reliability.

## Conclusion
Performance (latency) is **unlikely to be the primary cause** of the low completion rate. Users are receiving responses quickly and reliably.

## Recommendation
Investigate other potential causes for drop-off:
- Content quality/relevance (is the AI boring?).
- UX friction (e.g., confusing UI, hard to reply).
- User intent (are they just browsing?).
