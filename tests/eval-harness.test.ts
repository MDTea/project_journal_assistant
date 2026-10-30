import { describe, expect, it } from "vitest";
import type { ReviewedClaim } from "../src/lib/analysis/integrity";
import { AnalyzeRequestSchema, type CheckInAnalysis } from "../src/lib/analysis/schema";
import { EVAL_CASES } from "./evals/cases";
import { checkExpectations, matchesClaim } from "./evals/expect";

// Deterministic tests for the eval harness itself (no OpenAI calls).

function claim(overrides: Partial<ReviewedClaim>): ReviewedClaim {
  return {
    claim_text: "Madie wrote the API docs.",
    actors: ["Madie"],
    verb: "wrote",
    direct_object: "API docs",
    context: null,
    claim_type: "ownership_responsibility",
    creation_method: "auto_extracted",
    supporting_statement_orders: [2],
    status: "supported",
    evidence_statement_orders: [2],
    flags: [],
    ...overrides,
  };
}

const analysis: CheckInAnalysis = {
  claims: [],
  standup: { completed: ["Wrote API docs"], struggling: [], next: [] },
  summary: "Madie wrote the API docs.",
  star_candidate: null,
  clarifications_needed: [],
};

describe("matchesClaim", () => {
  it("matches text case-insensitively and actors as an exact set", () => {
    const c = claim({ actors: ["Jordan", "Madie"] });
    expect(matchesClaim(c, { textIncludes: ["api DOCS"], actors: ["madie", "jordan"] })).toBe(true);
    expect(matchesClaim(c, { actors: ["Madie"] })).toBe(false);
    expect(matchesClaim(c, { actorsInclude: ["Madie"] })).toBe(true);
  });

  it("treats actors: [] as 'no actors'", () => {
    expect(matchesClaim(claim({ actors: [] }), { actors: [] })).toBe(true);
    expect(matchesClaim(claim({}), { actors: [] })).toBe(false);
  });
});

describe("checkExpectations", () => {
  it("passes when every expectation holds", () => {
    const results = checkExpectations(
      { claims: [{ actors: ["Madie"] }], allowedActors: ["Madie"], star: "absent", clarification: false },
      analysis,
      [claim({})],
    );
    expect(results.every((r) => r.pass)).toBe(true);
  });

  it("fails a forbidden claim and an unexpected actor", () => {
    const results = checkExpectations(
      { forbiddenClaims: [{ actorsInclude: ["Madie"] }], allowedActors: ["Jordan"] },
      analysis,
      [claim({})],
    );
    expect(results.map((r) => r.pass)).toEqual([false, false]);
  });

  it("fails when the prose mentions a forbidden term", () => {
    const [r] = checkExpectations({ outputMustNotMention: ["API"] }, analysis, []);
    expect(r.pass).toBe(false);
  });
});

describe("EVAL_CASES", () => {
  it("have unique ids", () => {
    const ids = EVAL_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(EVAL_CASES)("$id is a valid analyze request", (c) => {
    const parsed = AnalyzeRequestSchema.safeParse({ date: "2026-10-29", statements: c.statements });
    expect(parsed.success).toBe(true);
  });
});
