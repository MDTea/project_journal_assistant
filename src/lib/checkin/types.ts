// In-memory shapes for Milestone 1. Field names deliberately mirror
// Schema v0.2 (CheckIn, CheckInStatement) so that Milestone 2 persistence
// is a direct mapping rather than a redesign.

/** Who produced a conversational statement (spec §10). Not the same as an Actor. */
export type Speaker = "Madie" | "ChatGPT";

/** Mirrors the CheckInStatement table, minus DB-assigned ids. */
export interface CheckInStatement {
  statement_order: number;
  speaker: Speaker;
  statement_text: string;
  created_at: string; // ISO 8601
}

export type CategoryId =
  | "completed"
  | "struggled"
  | "learning"
  | "proud"
  | "collaboration"
  | "goal"
  | "anything_else";

export interface ReflectionCategory {
  id: CategoryId;
  question: string;
}

export type CategoryStatus = "answered" | "skipped";
