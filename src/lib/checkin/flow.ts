import {
  CLOSING_MESSAGE,
  OPENING_QUESTION,
  REFLECTION_CATEGORIES,
  isSkipAnswer,
} from "./categories";
import type { CategoryId, CategoryStatus, CheckInStatement, Speaker } from "./types";

// Pure check-in state machine. No React, no I/O, so every transition is
// unit-testable. The UI only calls createSession() and submitInput().
//
//   awaiting_start --"Start"--> opening --answer--> categories x7 --> complete

export type CheckInPhase = "awaiting_start" | "opening" | "categories" | "complete";

export interface CheckInSession {
  phase: CheckInPhase;
  /** CheckIn.date: the local calendar date the check-in was started. */
  date: string | null;
  /** Index into REFLECTION_CATEGORIES of the question awaiting an answer. */
  currentCategoryIndex: number;
  /** The original conversation, preserved verbatim and in order. */
  statements: CheckInStatement[];
  categoryStatus: Partial<Record<CategoryId, CategoryStatus>>;
}

export type TurnResult =
  | { ok: true; session: CheckInSession }
  | { ok: false; error: string };

export function createSession(): CheckInSession {
  return {
    phase: "awaiting_start",
    date: null,
    currentCategoryIndex: 0,
    statements: [],
    categoryStatus: {},
  };
}

/**
 * Advance the check-in with one message from Madie. Returns a new session
 * (the input session is never mutated) or an error explaining why the
 * input was not accepted.
 */
export function submitInput(
  session: CheckInSession,
  input: string,
  now: Date = new Date(),
): TurnResult {
  const text = input.trim();
  if (text === "") {
    return { ok: false, error: "Type a response first." };
  }

  switch (session.phase) {
    case "awaiting_start": {
      // "Start" is a command, not check-in content, so it is not recorded
      // as a statement. Check-ins are only ever started explicitly.
      if (text.toLowerCase() !== "start") {
        return { ok: false, error: "Type “Start” to begin a check-in." };
      }
      return {
        ok: true,
        session: {
          ...createSession(),
          phase: "opening",
          date: toLocalDate(now),
          statements: [statement(1, "ChatGPT", OPENING_QUESTION, now)],
        },
      };
    }

    case "opening": {
      const statements = append(session.statements, now, [
        ["Madie", text],
        ["ChatGPT", REFLECTION_CATEGORIES[0].question],
      ]);
      return {
        ok: true,
        session: { ...session, phase: "categories", currentCategoryIndex: 0, statements },
      };
    }

    case "categories": {
      const category = REFLECTION_CATEGORIES[session.currentCategoryIndex];
      const categoryStatus = {
        ...session.categoryStatus,
        [category.id]: isSkipAnswer(text) ? "skipped" : "answered",
      };
      const nextIndex = session.currentCategoryIndex + 1;
      const isLast = nextIndex >= REFLECTION_CATEGORIES.length;
      const reply = isLast ? CLOSING_MESSAGE : REFLECTION_CATEGORIES[nextIndex].question;
      const statements = append(session.statements, now, [
        ["Madie", text],
        ["ChatGPT", reply],
      ]);
      return {
        ok: true,
        session: {
          ...session,
          phase: isLast ? "complete" : "categories",
          currentCategoryIndex: isLast ? session.currentCategoryIndex : nextIndex,
          statements,
          categoryStatus,
        },
      };
    }

    case "complete":
      return { ok: false, error: "This check-in is complete. Start a new one to continue." };
  }
}

function statement(
  order: number,
  speaker: Speaker,
  text: string,
  now: Date,
): CheckInStatement {
  return {
    statement_order: order,
    speaker,
    statement_text: text,
    created_at: now.toISOString(),
  };
}

function append(
  existing: CheckInStatement[],
  now: Date,
  turns: [Speaker, string][],
): CheckInStatement[] {
  const added = turns.map(([speaker, text], i) =>
    statement(existing.length + i + 1, speaker, text, now),
  );
  return [...existing, ...added];
}

function toLocalDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
