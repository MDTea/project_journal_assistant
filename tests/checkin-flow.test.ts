import { describe, expect, it } from "vitest";
import {
  CLOSING_MESSAGE,
  OPENING_QUESTION,
  REFLECTION_CATEGORIES,
  isSkipAnswer,
} from "../src/lib/checkin/categories";
import { createSession, submitInput, type CheckInSession } from "../src/lib/checkin/flow";

const NOW = new Date(2026, 9, 28, 14, 30); // Oct 28 2026, local time

function send(session: CheckInSession, text: string): CheckInSession {
  const result = submitInput(session, text, NOW);
  if (!result.ok) throw new Error(`unexpected rejection: ${result.error}`);
  return result.session;
}

function runFullCheckIn(answers: string[]): CheckInSession {
  let s = send(createSession(), "Start");
  s = send(s, "I set up the repo and scaffolded the app.");
  for (const a of answers) s = send(s, a);
  return s;
}

describe("starting a check-in", () => {
  it("only starts when Madie explicitly types Start", () => {
    const result = submitInput(createSession(), "hello", NOW);
    expect(result.ok).toBe(false);
  });

  it("accepts Start case-insensitively and asks the opening question", () => {
    const s = send(createSession(), "  start ");
    expect(s.phase).toBe("opening");
    expect(s.date).toBe("2026-10-28");
    expect(s.statements).toEqual([
      expect.objectContaining({
        statement_order: 1,
        speaker: "ChatGPT",
        statement_text: OPENING_QUESTION,
      }),
    ]);
  });

  it("rejects empty input without changing state", () => {
    const s = send(createSession(), "Start");
    const result = submitInput(s, "   ", NOW);
    expect(result.ok).toBe(false);
  });
});

describe("guided categories", () => {
  it("asks all seven categories in order, then closes", () => {
    const answers = REFLECTION_CATEGORIES.map((c) => `answer for ${c.id}`);
    const s = runFullCheckIn(answers);

    const questions = s.statements
      .filter((st) => st.speaker === "ChatGPT")
      .map((st) => st.statement_text);
    expect(questions).toEqual([
      OPENING_QUESTION,
      ...REFLECTION_CATEGORIES.map((c) => c.question),
      CLOSING_MESSAGE,
    ]);
    expect(s.phase).toBe("complete");
  });

  it("preserves Madie's answers verbatim with contiguous statement_order", () => {
    const answers = REFLECTION_CATEGORIES.map((c) => `answer for ${c.id}`);
    const s = runFullCheckIn(answers);

    expect(s.statements.map((st) => st.statement_order)).toEqual(
      s.statements.map((_, i) => i + 1),
    );
    const madie = s.statements.filter((st) => st.speaker === "Madie");
    expect(madie.map((st) => st.statement_text)).toEqual([
      "I set up the repo and scaffolded the app.",
      ...answers,
    ]);
  });

  it("accepts skip answers without forcing content", () => {
    const answers = REFLECTION_CATEGORIES.map(() => "N/A");
    answers[0] = "Finished the ERD.";
    const s = runFullCheckIn(answers);

    expect(s.phase).toBe("complete");
    expect(s.categoryStatus.completed).toBe("answered");
    expect(s.categoryStatus.struggled).toBe("skipped");
    expect(s.categoryStatus.anything_else).toBe("skipped");
  });

  it("rejects further input once the check-in is complete", () => {
    const s = runFullCheckIn(REFLECTION_CATEGORIES.map(() => "Skip"));
    expect(submitInput(s, "one more thing", NOW).ok).toBe(false);
  });

  it("does not mutate the previous session", () => {
    const before = send(createSession(), "Start");
    const snapshot = structuredClone(before);
    send(before, "Did some work");
    expect(before).toEqual(snapshot);
  });
});

describe("isSkipAnswer", () => {
  it.each(["N/A", "skip", "Nothing new.", "none", "Skip!"])("treats %j as a skip", (t) => {
    expect(isSkipAnswer(t)).toBe(true);
  });

  it.each(["Nothing new except the ERD", "I skipped lunch to debug"])(
    "treats %j as a real answer",
    (t) => {
      expect(isSkipAnswer(t)).toBe(false);
    },
  );
});
