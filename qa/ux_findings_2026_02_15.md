# UX Findings - February 15, 2026

**Reviewer:** Pixel
**Scope:** Initial Onboarding & Debate Start Flow

## 1. Quick Start Friction (High)
**Observation:** Clicking a "Quick Start" topic (e.g., "Free will is an illusion") updates the "Today's Debate" card but leaves the user hanging. The user must then realize they need to type an argument in the input box below.
**Friction:** The connection between "Clicking a topic" and "Typing an argument" is weak. The page scrolls to the top, potentially moving the input field *out* of the primary focus area if the hero section is large.
**Recommendation:** When a Quick Start is clicked, automatically focus the argument input and scroll it into view. This guides the user to the next step immediately.

## 2. Aggressive Onboarding Overlay (Medium)
**Observation:** The `OnboardingOverlay` uses a backdrop (`rgba(0,0,0,0.55)`) that blocks interaction with the rest of the page. It requires a 3-step "Next/Next/Got it" flow to dismiss.
**Friction:** Users just want to start. Blocking the UI creates barriers.
**Recommendation:** Remove the backdrop or make it click-through. Allow the user to interact with the highlighted element (Input) directly without dismissing the tour first.

## 3. "Start Debate" Empty State (Low)
**Observation:** If a user clicks "Start Debate" without typing, the input shakes.
**Friction:** Some users might expect the AI to speak first (as in ChatGPT). The requirement for an opening argument isn't explicitly clear until the error state (shake) triggers.
**Recommendation:** Add a placeholder or a "Let AI start" option, or make the placeholder text more directive ("Type your opening argument to begin...").

## Action Plan
- [x] Document findings.
- [ ] Fix **Quick Start Friction** in `src/app/HomeClient.tsx`.
- [ ] Verify fix locally.
