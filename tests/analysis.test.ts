import { describe, expect, it } from "vitest";
import { reviewClaims } from "../src/lib/analysis/integrity";
import {
  AnalyzeRequestSchema,
  CheckInAnalysisSchema,
  type ExtractedClaim,
} from "../src/lib/analysis/schema";
import type { CheckInStatement } from "../src/lib/checkin/types";
import { buildAnalysisInput } from "../src/lib/llm/prompt";

const AT = "2026-10-29T18:00:00.000Z";
const transcript: CheckInStatement[] = [
  { statement_order: 1, speaker: "ChatGPT", statement_text: "Hi, what did you do today?", created_at: AT },
  {
    statement_order: 2,
    speaker: "Madie",
    statement_text: "I wrote the validation logic while Jordan implemented auth.",
    created_at: AT,
  },
  { statement_order: 3, speaker: "ChatGPT", statement_text: "So you owned the auth module?", created_at: AT },
  { statement_order: 4, speaker: "Madie", statement_text: "12 of 20 test cases passed.", created_at: AT },
];

function claim(overrides: Partial<ExtractedClaim>): ExtractedClaim {
  return {
    claim_text: "Madie wrote the validation logic.",
    actors: ["Madie"],
    verb: "wrote",
    direct_object: "validation logic",
    context: null,
    claim_type: "ownership_responsibility",
    creation_method: "auto_extracted",
    supporting_statement_orders: [2],
    ...overrides,
  };
}

describe("reviewClaims", () => {
  it("marks a claim backed by a Madie statement as supported", () => {
    const [c] = reviewClaims([claim({})], transcript);
    expect(c.status).toBe("supported");
    expect(c.evidence_statement_orders).toEqual([2]);
    expect(c.flags).toEqual([]);
  });

  it("CE-4: a claim supported only by an assistant statement stays unresolved", () => {
    const [c] = reviewClaims(
      [claim({ claim_text: "Madie owned the auth module.", supporting_statement_orders: [3] })],
      transcript,
    );
    expect(c.status).toBe("unresolved");
    expect(c.evidence_statement_orders).toEqual([]);
    expect(c.flags[0]).toMatch(/assistant statement #3/);
  });

  it("drops citations to statements that do not exist", () => {
    const [c] = reviewClaims([claim({ supporting_statement_orders: [2, 99] })], transcript);
    expect(c.status).toBe("supported");
    expect(c.evidence_statement_orders).toEqual([2]);
    expect(c.flags[0]).toMatch(/#99/);
  });

  it("flags a claim with no cited evidence", () => {
    const [c] = reviewClaims([claim({ supporting_statement_orders: [] })], transcript);
    expect(c.status).toBe("unresolved");
    expect(c.flags).toContain("No supporting statement cited.");
  });

  it("supports zero, one, or multiple actors", () => {
    const reviewed = reviewClaims(
      [
        claim({ actors: [], claim_type: "quantitative_event", supporting_statement_orders: [4] }),
        claim({}),
        claim({ actors: ["Madie", "Jordan", " madie "] }),
      ],
      transcript,
    );
    expect(reviewed.map((c) => c.actors)).toEqual([[], ["Madie"], ["Madie", "Jordan"]]);
  });

  it("lets one statement support multiple claims", () => {
    const reviewed = reviewClaims(
      [
        claim({}),
        claim({ claim_text: "Jordan implemented auth.", actors: ["Jordan"], supporting_statement_orders: [2] }),
      ],
      transcript,
    );
    expect(reviewed.every((c) => c.status === "supported")).toBe(true);
  });
});

describe("CheckInAnalysisSchema", () => {
  const valid = {
    claims: [claim({})],
    standup: { completed: ["Validation logic"], struggling: [], next: ["Wire auth"] },
    summary: "Madie wrote validation logic.",
    star_candidate: null,
    clarifications_needed: [],
  };

  it("accepts a check-in with no STAR story", () => {
    expect(CheckInAnalysisSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown claim_type", () => {
    const bad = { ...valid, claims: [{ ...claim({}), claim_type: "vibes" }] };
    expect(CheckInAnalysisSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects output missing required sections", () => {
    const missing: Partial<typeof valid> = { ...valid };
    delete missing.standup;
    expect(CheckInAnalysisSchema.safeParse(missing).success).toBe(false);
  });
});

describe("AnalyzeRequestSchema", () => {
  it("rejects a speaker other than Madie or ChatGPT", () => {
    const bad = {
      date: "2026-10-29",
      statements: [{ ...transcript[1], speaker: "Jordan" }],
    };
    expect(AnalyzeRequestSchema.safeParse(bad).success).toBe(false);
  });
});

describe("buildAnalysisInput", () => {
  it("numbers statements and labels speakers in order", () => {
    const shuffled = [transcript[2], transcript[0], transcript[3], transcript[1]];
    const input = buildAnalysisInput("2026-10-29", shuffled);
    expect(input).toContain("Check-in date: 2026-10-29");
    expect(input.indexOf("[#1] ChatGPT:")).toBeLessThan(input.indexOf("[#2] Madie:"));
    expect(input.indexOf("[#3] ChatGPT:")).toBeLessThan(input.indexOf("[#4] Madie:"));
  });
});
