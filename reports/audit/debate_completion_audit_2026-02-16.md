# Audit: Debate Completion Flow
**Date:** 2026-02-12
**Analyst:** Echo

## Current Status
- **Metric:** ~3% Completion Rate (Critical Issue)
- **Goal:** 60%+ Completion Rate
- **Observation:** Users start but don't finish.

## Flow Analysis (Heuristic)
1.  **Landing:** Strong hook ("Fight the AI").
2.  **Engagement:** Immediate input field (Good).
3.  **Friction:** Sign-up wall appears immediately after first input? (Based on "We'll save your debate after you sign in").
    - **Issue:** High drop-off likely here. Users haven't received value yet.
4.  **Debate Loop:** Unknown length.
    - **Issue:** Does the debate end? If it's infinite, "completion" is impossible/undefined for the user.
    - **Issue:** No clear "win state". Users debate until bored.

## Hypothesis
The primary drivers of low completion are:
1.  **Lack of Closure:** Users don't know *when* or *how* to finish.
2.  **Early Friction:** Sign-up wall before value delivery (being addressed by Guest Mode task).
3.  **No Incentive:** "Completing" a debate offers no reward (score, badge, summary).

## Proposed Experiments

### Experiment 1: The "Verdict" Feature (Gamification)
**Concept:** Introduce a "Get Verdict" button available after 3 turns.
**Mechanism:**
- After 3 user turns, a button "Ask Judge for Verdict" appears.
- AI (Judge Persona) analyzes the thread and declares a winner with a score.
**Hypothesis:** Users will stay to see if they "won".
**Metric:** % of sessions reaching "Verdict" screen.

### Experiment 2: Explicit Turn Limits (Expectation Setting)
**Concept:** Frame the debate as a "5-Round Match".
**Mechanism:**
- UI shows "Round 1/5".
- At Round 5, the debate automatically concludes with a summary.
**Hypothesis:** Knowing the commitment length reduces abandonment.
**Metric:** % of sessions reaching Round 5.

### Experiment 3: "Sudden Death" Mode (High Stakes)
**Concept:** A mode where the AI can "knock out" the user if they use a fallacy, ending the debate immediately (as a loss).
**Mechanism:**
- If AI detects a logical fallacy, it calls it out and ends the debate: "You lost: Ad Hominem detected."
- Users try to survive as long as possible.
**Hypothesis:** High tension/stakes increases focus and retention.
**Metric:** Avg turns per session (should increase as users try to survive).

## Next Steps
- Implement "Verdict" button as low-hanging fruit (requires backend support for summary generation).
- A/B test Turn Limits vs Infinite Flow.
