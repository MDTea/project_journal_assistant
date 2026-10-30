import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import OpenAI from "openai";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reviewClaims, type ReviewedClaim } from "../../src/lib/analysis/integrity";
import type { CheckInAnalysis } from "../../src/lib/analysis/schema";
import { analysisModel, analyzeCheckIn } from "../../src/lib/llm/openai";
import { EVAL_CASES } from "./cases";
import { checkExpectations, type CheckResult } from "./expect";

// One describe block per case: the model is called once in beforeAll, and
// each expectation is its own test so failures are reported individually.
// Optional filter: EVAL_CASE=ambiguous-we npm run eval

const only = process.env.EVAL_CASE;
const cases = only ? EVAL_CASES.filter((c) => c.id === only) : EVAL_CASES;

interface CaseReport {
  id: string;
  probes: string;
  analysis?: CheckInAnalysis;
  claims?: ReviewedClaim[];
  checks?: CheckResult[];
  error?: string;
}
const report: CaseReport[] = [];

// New OpenAI accounts allow only ~10 requests/minute, so cases run one at a
// time and wait out rate limits instead of failing.
async function analyzeWithRetry(statements: Parameters<typeof analyzeCheckIn>[1]) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await analyzeCheckIn("2026-10-29", statements);
    } catch (err) {
      const rateLimited = err instanceof OpenAI.APIError && err.status === 429;
      const outOfCredits = rateLimited && err.code === "insufficient_quota";
      if (!rateLimited || outOfCredits || attempt >= 6) throw err;
      await sleep(15_000);
    }
  }
}

describe.each(cases)("$id", (evalCase) => {
  let checks: CheckResult[] = [];
  const entry: CaseReport = { id: evalCase.id, probes: evalCase.probes };
  report.push(entry);

  beforeAll(async () => {
    try {
      const analysis = await analyzeWithRetry(evalCase.statements);
      const claims = reviewClaims(analysis.claims, evalCase.statements);
      checks = checkExpectations(evalCase.expect, analysis, claims);
      Object.assign(entry, { analysis, claims, checks });
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  });

  it("meets all expectations", () => {
    const failed = checks.filter((c) => !c.pass);
    expect(failed.map((c) => `${c.name}: ${c.detail}`)).toEqual([]);
  });
});

afterAll(() => {
  const dir = new URL("./results/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  const order = new Map(EVAL_CASES.map((c, i) => [c.id, i]));
  report.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const out = { model: analysisModel(), ranAt: new Date().toISOString(), cases: report };
  writeFileSync(new URL("latest.json", dir), JSON.stringify(out, null, 2));

  const lines = report.map((r) => {
    if (r.error) return `ERROR ${r.id}: ${r.error}`;
    const failed = r.checks!.filter((c) => !c.pass);
    const mark = failed.length ? "FAIL " : "PASS ";
    return mark + r.id + failed.map((c) => `\n      - ${c.name}\n        ${c.detail}`).join("");
  });
  const passed = report.filter((r) => !r.error && r.checks!.every((c) => c.pass)).length;
  console.log(
    `\nEval summary (${out.model}): ${passed}/${report.length} cases passed\n  ${lines.join("\n  ")}\n` +
      `Full outputs: tests/evals/results/latest.json\n`,
  );
});
