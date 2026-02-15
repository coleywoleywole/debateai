# Frontend Investigation: Debate Completion Rate

**Investigator:** Pixel (Frontend)
**Date:** February 14, 2026
**Task:** [PIXEL] Investigate Root Cause of Low Debate Completion Rate

## Hypothesis
While backend limits (Guest limit 5) are a major factor, the frontend likely contributes to abandonment through:
1.  **Lack of Progress Indicators:** Users don't know how long a debate will take.
2.  **Confusing "Waiting" States:** When the AI is "thinking," the UI might look stalled or boring.
3.  **Mobile Friction:** The layout on mobile (where most users are) might be cramping the chat experience.

## Context
Debate completion rate is at 2.7%. This is a critical issue.
This investigation consolidates findings from task `jx7bbas236pesa0cwnzz5er5n1815v14` as well.
The backend investigation (by Forge) identified strict message limits as a cause. This report focuses purely on the frontend UX.

## Visual Audit Plan
I will be conducting a full visual audit of the following screens:

### 1. Landing Page -> Debate Setup
-   **Goal:** Does the user understand what they are about to do?
-   **Risk:** Button placement, copy clarity.

### 2. Active Debate Interface
-   **Goal:** Is the conversation flow natural?
-   **Risk:** Input field accessibility on mobile, "Thinking" animation visibility.

### 3. Debate Conclusion
-   **Goal:** Does the user feel accomplished?
-   **Risk:** Anti-climactic ending, confusing next steps.

## Next Steps
-   [ ] Execute visual audit (screenshots required).
-   [ ] Analyze "Time to Interactive" metrics.
-   [ ] Propose UI changes to "gamify" the progress (e.g., a progress bar or turn counter).
