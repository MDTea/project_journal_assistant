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

### 1b: Structured analysis (built; awaiting live verification)

```text
Browser (CheckInChat)                Server (POST /api/analyze)                     OpenAI
transcript ──────────────────────▶  1. AnalyzeRequestSchema validates the body
                                     2. buildAnalysisInput() → numbered transcript ─▶ responses.parse
                                     3. SDK parses the reply with CheckInAnalysisSchema ◀─ JSON
                                     4. reviewClaims() checks claims vs. transcript
review screen ◀──────────────────── 5. { analysis, claims (with status + flags) }
```

| File | Responsibility |
|---|---|
| `src/lib/analysis/schema.ts` | Zod schemas: the model's output shape and the request body |
| `src/lib/llm/prompt.ts` | Instructions and evidence packet (readable, testable) |
| `src/lib/llm/openai.ts` | The only OpenAI call; `server-only` keeps the key off the client |
| `src/lib/analysis/integrity.ts` | Deterministic claim checks; assigns `supported` / `unresolved` |
| `src/app/api/analyze/route.ts` | Route handler wiring the steps together |
| `src/components/AnalysisReview.tsx` | Review screen |

`CheckInAnalysis` (handoff §15, refined):

- `claims[]`: `claim_text`, `actors[]`, `verb`, `direct_object`, `context`, `claim_type`, `creation_method`, `supporting_statement_orders[]`
- `standup`: `completed[]`, `struggling[]`, `next[]`
- `summary`: the 3–6 sentence reflection (the app supplies the date, not the model)
- `star_candidate`: Situation/Task/Action/Result/Learning, or `null`
- `clarifications_needed[]`: **added in 1b.** This gives the model somewhere to put ambiguous ownership ("we") instead of guessing. The questions are shown for review; answering them is Milestone 3.

**Integrity rules (enforced in code, not the prompt):**

- Claim status is assigned by the app, never by the model.
- `supported` requires at least one cited statement that exists **and** was spoken by Madie.
- Citations to assistant statements are flagged and ignored (CE-4). Citations to non-existent statements are flagged and dropped.
- A claim with no valid Madie evidence is `unresolved`.

**Model:** defaults to `gpt-5.4-mini`. Override with `OPENAI_MODEL` in `.env.local`. Requests use `store: false`.

### 1c: Conversational follow-ups (planned)

- The LLM chooses the next question: follow-ups when an answer reveals a decision, failure, ambiguity in ownership or learning (Context → Decision → Reasoning → Implementation → Result → Learning), while still making sure all seven categories are covered.

## Exit criteria (before Milestone 2)

- Madie can explain the Milestone 1 flow end to end.
- Structured output behaves acceptably on a handful of real check-ins.
