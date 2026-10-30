# Milestone 1: Smallest Vertical Slice

**Goal:** Start → guided check-in → in-session answers → LLM structured analysis → Claims + Standup + Reflection + optional STAR → review screen.

**Out of scope:** Supabase/persistence, Google Docs, file upload/retrieval, authentication, background jobs, vector search. Everything lives in browser memory and disappears on refresh.

## Slices

Milestone 1 is built in three reviewable slices. Each one should run, pass its tests, and be explainable before the next begins.

### 1a: Scripted check-in (done)

- Next.js + TypeScript app scaffold.
- Madie types **Start**. Nothing happens until she does; there is no autonomous check-in.
- The assistant asks the opening question, then the seven reflection categories in order.
- Answers such as *N/A*, *Skip* or *Nothing new* are accepted and recorded as "skipped" coverage.
- The full conversation is kept as an ordered list of `CheckInStatement`-shaped objects (`statement_order`, `speaker`, `statement_text`, `created_at`).

**Design note:** The check-in logic lives in `src/lib/checkin/flow.ts` as a pure state machine (`createSession`, `submitInput`) with no React and no I/O. The UI only renders state and forwards input. That separation is what makes the flow unit-testable (`tests/checkin-flow.test.ts`). It also means slice 1c can replace the scripted question selection without rewriting the UI.

**Decisions made in 1a:**

- "Start" is treated as a command, not as a CheckInStatement.
- The assistant speaker is stored as `"ChatGPT"`, matching the spec's V1 Speaker values. CE-4 applies: assistant statements can never independently establish Madie's ownership.
- Skip detection is a small fixed list of phrases. An answer like "Nothing new except the ERD" counts as a real answer.

### 1b: Structured analysis (next)

- Server-side route handler calls the OpenAI API. The key is only ever read on the server from `.env.local`.
- The LLM returns a `CheckInAnalysis` (handoff §15), and a Zod schema validates it before the app uses it:
  - `claims[]`: `claim_text`, `actors[]`, `verb`, `direct_object`, `context`, `claim_type`, and the supporting `statement_order`(s)
  - `standup`: `completed`, `struggling`, `next`
  - `summary`: a 3–6 sentence dated reflection
  - `star_candidate`: STAR + Learning, or `null` when no meaningful story exists
- A review screen shows the Claims with their supporting statements, plus the standup, reflection and STAR candidate.
- Application-level checks: a Claim must cite at least one statement, cited statements must exist, and a Claim supported only by ChatGPT statements is flagged (CE-4).

### 1c: Conversational follow-ups (planned)

- The LLM chooses the next question: follow-ups when an answer reveals a decision, failure, ambiguity in ownership or learning (Context → Decision → Reasoning → Implementation → Result → Learning), while still making sure all seven categories are covered.

## Exit criteria (before Milestone 2)

- Madie can explain the Milestone 1 flow end to end.
- Structured output behaves acceptably on a handful of real check-ins.
