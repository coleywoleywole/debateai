/**
 * Live Judge — real-time debate coaching
 * Provides ongoing feedback during the debate using gemini-2.5-flash-lite
 * Private to the user (AI opponent never sees this)
 */

export interface LiveJudgeHighlight {
  text: string; // exact quote from user's message
  type: 'strong' | 'weak' | 'fallacy' | 'good-evidence';
  comment: string; // brief explanation
}

export interface LiveJudgeFeedback {
  overallScore: number; // 0-100
  strengths: string[]; // 1-2 items, 1 sentence each
  weaknesses: string[]; // 1-2 items, 1 sentence each
  tip: string; // actionable advice for next argument
  highlights: LiveJudgeHighlight[];
  debateSummarySoFar: string; // 2-sentence running summary for next call
}

export function getLiveJudgeSystemPrompt(): string {
  return `You are a debate coach scoring arguments using this STRICT rubric:

SCORE RUBRIC (follow exactly):
0-15: No argument. One word, agreement, empty, off-topic, or gibberish.
16-30: Bare assertion. States opinion with zero reasoning or evidence.
31-45: Weak argument. Has a claim + some reasoning, but doesn't engage with opponent's points. Dodges or ignores what they said.
46-60: Decent argument. Makes a point WITH reasoning AND engages with what opponent said. But may have logical gaps.
61-75: Good argument. Clear reasoning, directly rebuts opponent, provides examples or evidence.
76-90: Strong argument. Tight logic, strong evidence, effectively dismantles opponent's key claims, anticipates counters.
91-100: Exceptional. Airtight reasoning, compelling evidence, addresses every opponent point, reframes the debate.

CRITICAL RULES:
- "disagree" or "no" or "I think you're wrong" with no reasoning = score 0-15. ALWAYS.
- If user didn't address what the opponent said, say so directly.
- Call out fallacies by name: straw man, ad hominem, appeal to authority, false dichotomy, etc.
- Tell them what the opponent left exposed — give a specific tactical next move.
- highlights.text must be EXACT copy-paste substrings from the user's message. If the message is too short for meaningful highlights, return empty highlights array.
- Be honest. A bad argument gets a bad score. Don't sugarcoat.
- Keep all text SHORT and punchy. Coach, not professor.
- Respond with ONLY valid JSON.`;
}

export function getLiveJudgeUserPrompt(
  topic: string,
  latestUserMsg: string,
  latestAiMsg: string,
  runningSummary?: string,
): string {
  const contextSection = runningSummary
    ? `\nSTORY SO FAR: ${runningSummary}\n`
    : '';

  return `TOPIC: "${topic}"
${contextSection}
USER'S ARGUMENT:
${latestUserMsg}

OPPONENT'S RESPONSE:
${latestAiMsg}

Score the user's argument using the rubric. Did they engage with the opponent or dodge? What did the opponent leave exposed? What should they do next?

highlights[].text MUST be exact character-for-character substrings copied from "USER'S ARGUMENT" above. If the argument is very short (under 10 words), return highlights as [].

JSON only:
{
  "overallScore": <0-100, use rubric strictly>,
  "strengths": ["<max 10 words, or empty array if none>"],
  "weaknesses": ["<max 10 words>"],
  "tip": "<specific tactical next move, max 15 words>",
  "highlights": [{"text": "<EXACT substring from user's argument>", "type": "strong|weak|fallacy|good-evidence", "comment": "<max 6 words>"}],
  "debateSummarySoFar": "<1-2 sentences>"
}`;
}
