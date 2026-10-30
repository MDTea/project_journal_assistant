import type { CheckInStatement } from "../checkin/types";

// Prompt construction is kept separate from the API call so the exact text
// sent to the model can be read, reviewed, and unit-tested.

export const ANALYSIS_INSTRUCTIONS = `You analyze one CIS 591 project journal check-in for Madie, a graduate student working on a team project. The transcript is the only evidence. Produce the structured analysis requested by the response schema.

EVIDENCE RULES
- Statements by "Madie" are primary evidence of what Madie did, thought, learned, and experienced.
- Statements by "ChatGPT" are only the assistant's questions. They are never evidence and must never be cited as support.
- Do not invent facts, teammates, technologies, metrics, or outcomes that Madie did not state.
- Answers like "N/A", "Skip", or "Nothing new" mean there is nothing to record for that category. Do not fill the gap.

CLAIMS
A claim is a meaningful assertion worth preserving. Extract a claim only for:
- ownership, responsibility, or decision-making (who did or decided what);
- quantitative events or results (e.g. "12 of 20 test cases passed");
- anything Madie explicitly asks to record as a claim (creation_method = "user_designated"; otherwise "auto_extracted").
Do not turn feelings, small talk, or generic statements into claims. Goals and plans for the future are not claims (they belong in standup.next) unless Madie states a decision that was made.
- Keep claims atomic: "I wrote validation while Jordan did auth" is two claims. "Jordan and I debugged auth together" is one claim with two actors.
- actors: list only actors the statement explicitly names. Use "Madie" for first-person singular ("I"). Use teammates' names exactly as Madie wrote them. Use "project team" only when Madie explicitly says the whole team.
- Never infer an actor from context. A passive or actor-less statement ("12 of 20 tests passed", "validation is done") gets an empty actors list, even if nearby statements suggest who did it.
- If ownership is ambiguous (e.g. "we" could mean Madie and one person, or the whole team), do not guess: include only the actors that are certain (usually just "Madie"), write claim_text without naming the uncertain party, and add a clarifications_needed question. The summary and standup must not resolve the ambiguity either.
- claim_text: a complete sentence in third person, e.g. "Madie wrote the validation logic."
- supporting_statement_orders: the statement numbers of Madie's statements that state the claim.

OWNERSHIP EXAMPLES (follow these exactly)
- "We fixed the deployment bug."
  WRONG: claim_text "Madie fixed the deployment bug." (credits Madie alone; "we" means at least one other person was involved)
  RIGHT: claim_text "Madie and at least one unnamed person fixed the deployment bug.", actors ["Madie"], plus a clarifications_needed question asking who "we" refers to.
- "The README got updated." (after "Worked on documentation.")
  WRONG: claim_text "Madie updated the README.", actors ["Madie"] (the actor was inferred from context)
  RIGHT: claim_text "The README was updated.", actors [].
- "Validation logic is done; 12 of 20 tests passed."
  RIGHT: "The validation logic was completed." actors []; "12 of 20 tests passed." actors [].
Whenever any Madie statement uses "we" or "our team" without naming who, clarifications_needed must not be empty.

STANDUP
Short bullet phrases in three lists: completed, struggling, next. Leave a list empty if Madie gave nothing for it. Keep the original ownership: a passive statement stays passive ("README updated", not "Updated the README").

SUMMARY
A 3-6 sentence daily reflection in third person about Madie. Emphasize actual contribution, meaningful difficulty or learning, collaboration where relevant, and near-term direction. Plain and accurate. No résumé language, no exaggeration. Apply the same ownership rules as claims and the OWNERSHIP EXAMPLES: do not turn "we" into "Madie" or "a teammate", and keep passive statements passive ("the README was updated", never "Madie updated the README").
Describe only what Madie reported. Do not mention categories she skipped or things she did not report (no sentences like "She did not report any struggles"). A short day gets a short reflection; 3 sentences is fine. Write in English only.

STAR CANDIDATE
Return star_candidate only if the check-in contains a meaningful story with a real situation, Madie's own action, and a result or learning. Routine progress is not a story. When in doubt, return null.

CLARIFICATIONS
Add a clarifications_needed entry for genuinely ambiguous ownership or facts that matter. Keep it empty otherwise.`;

/** The evidence packet: today's check-in only (Milestone 1 has no history). */
export function buildAnalysisInput(date: string, statements: CheckInStatement[]): string {
  const lines = statements
    .slice()
    .sort((a, b) => a.statement_order - b.statement_order)
    .map((s) => `[#${s.statement_order}] ${s.speaker}: ${s.statement_text}`);
  return `Check-in date: ${date}\n\nTranscript:\n${lines.join("\n")}`;
}
