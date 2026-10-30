# LLM Evaluation Set

Claim extraction is probabilistic, so unit tests alone cannot show whether the prompt is behaving (spec §34, handoff §16). The eval set runs fixed, fictional check-ins through the **real** analysis pipeline (`analyzeCheckIn` + `reviewClaims`) and checks properties that must hold however the model words its answer.

## Two kinds of tests

| | `npm test` | `npm run eval` |
|---|---|---|
| What | Deterministic app logic | LLM behavior |
| Calls OpenAI | Never | Yes (costs a few cents per run) |
| Result | Must always pass | A score to track over time |
| Files | `tests/*.test.ts` | `tests/evals/*.eval.ts`, `tests/evals/cases.ts` |

## Running

```bash
npm run eval                                   # all cases (needs OPENAI_API_KEY in .env.local)
EVAL_CASE=ambiguous-we npm run eval            # one case (Git Bash / macOS / Linux)
```

In PowerShell, run one case with `$env:EVAL_CASE="ambiguous-we"; npm run eval`.

Each run prints a summary and writes every case's full model output to `tests/evals/results/latest.json`, which is git-ignored.

## How a case works

```ts
{
  id: "teammate-ownership",
  probes: "A teammate's work is not credited to Madie.",
  statements: scripted("Mostly code review today. Jordan set up the GitHub Actions CI pipeline."),
  expect: {
    claims:          [{ textIncludes: ["pipeline"], actors: ["Jordan"] }],      // must exist
    forbiddenClaims: [{ textIncludes: ["pipeline"], actorsInclude: ["Madie"] }], // must not exist
  },
}
```

`scripted()` runs answers through the real check-in flow. `raw()` builds a transcript by hand for situations the scripted assistant cannot produce, such as the assistant suggesting ownership. The available expectations are in `tests/evals/expect.ts`, and the harness itself is unit-tested in `tests/eval-harness.test.ts`.

**Add a case whenever a real check-in exposes a new failure.** That is how the set comes to reflect how you actually write.

## Coverage (handoff §16)

| §16 case | Eval case id(s) |
|---|---|
| Clear personal ownership | `personal-ownership` |
| Team ownership | `team-ownership` |
| Teammate ownership | `teammate-ownership` |
| Ambiguous ownership | `ambiguous-we` |
| Quantitative results | `quantitative-no-actor`, `passive-statement` |
| Multiple atomic claims in one sentence | `multiple-atomic`, `joint-work` |
| Non-claim conversational statements | `non-claim-chatter` |
| Explicit user-designated claims | `user-designated` |
| AI-generated ownership assumptions | `ai-ownership-assumption` |
| No meaningful career evidence | `no-career-evidence`, `skips-not-filled` (plus `star-warranted` as a positive control) |
| Conflicting evidence / false contradictions | Deferred to Milestone 3 (needs history across check-ins) |

## Baseline: 2026-10-29, `gpt-5.4-mini`, prompt from slice 1b

**12 / 14 cases pass.** The same two cases failed on two separate runs, so these are consistent behaviors rather than noise:

| Case | Failure |
|---|---|
| `ambiguous-we` | "We fixed the deployment bug" → *"Madie fixed the deployment bug"*, with no clarification asked. Credits Madie with sole ownership. |
| `passive-statement` | "The README got updated" → *"Madie updated the README."* An actor was inferred from context. |

A third case, `skips-not-filled`, initially failed because its check was too strict, not because of the model: "no collaboration updates" is not invented collaboration. The check was corrected. That run also showed a quality issue the set doesn't yet test: summaries padded with "she did not report X" filler.

## Run log

| Date | Change | Score | Notes |
|---|---|---|---|
| 2026-10-29 | Baseline (slice 1b prompt) | 12/14 (×2 runs) | `ambiguous-we` and `passive-statement` failed consistently |
| 2026-10-29 | Added WRONG/RIGHT ownership examples to the prompt | 14/14 (×2 runs) | Claims fixed, but the reflection still said "…and updated the README" in 2 of 3 single-case runs. Added a summary check to `passive-statement` |
| 2026-10-29 | Applied ownership examples to summary and standup; asked for no skip filler | 14/14 | Ownership correct in every summary |

**Known issue, not yet scored:** nearly every summary is padded with sentences like "She did not report any struggles, learning moments, or near-term goals." The prompt instruction against this had no visible effect. The likely cause is that the transcript sent to the model contains every skipped question with its "N/A" answer, and the model narrates them. Possible fix (a design decision): leave skipped question/answer pairs out of the evidence packet sent to the model, while still preserving them in the stored conversation.

**Observed once/twice:** a stray non-English word ("նշել") appeared inside that filler sentence in two runs. "Write in English only" was added to the prompt.

**Rate limits:** new OpenAI accounts allow about 10 requests/minute. The runner executes cases one at a time and waits and retries on HTTP 429, so a full run takes about 1–2 minutes.

When changing the prompt or model, run the full set before and after, and add a row to the run log.
