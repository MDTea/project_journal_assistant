import type { ReflectionCategory } from "./types";

export const OPENING_QUESTION = "Hi, what did you do today for your project?";

export const CLOSING_MESSAGE =
  "Thanks, Madie. That covers all seven categories. Review your check-in transcript below.";

/**
 * The seven reflection categories (handoff §3). They are coverage
 * categories, not a rigid questionnaire: slice 1c will let the LLM ask
 * follow-ups and rephrase. Slice 1a asks them verbatim, in order.
 */
export const REFLECTION_CATEGORIES: readonly ReflectionCategory[] = [
  { id: "completed", question: "What did you complete today?" },
  { id: "struggled", question: "What did you struggle with today?" },
  { id: "learning", question: "Did you have any learning moments?" },
  { id: "proud", question: "What is something you are proud of yourself for doing?" },
  {
    id: "collaboration",
    question: "Did you work with anyone on the team today? If so, what was that like?",
  },
  {
    id: "goal",
    question: "Do you have a goal for what you want to do or complete in the near future?",
  },
  { id: "anything_else", question: "Anything else you want to document?" },
];

const SKIP_ANSWERS = new Set([
  "n/a",
  "na",
  "skip",
  "nothing new",
  "nothing",
  "none",
  "no",
  "nope",
  "not today",
]);

/** True when Madie declines a category rather than answering it (spec §7). */
export function isSkipAnswer(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.!]+$/, "");
  return SKIP_ANSWERS.has(normalized);
}
