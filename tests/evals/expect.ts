import type { ReviewedClaim } from "../../src/lib/analysis/integrity";
import type { CheckInAnalysis } from "../../src/lib/analysis/schema";

// Expectations are written as properties that must hold regardless of how
// the model words things, so an eval case can pass on many valid outputs.

export interface ClaimMatcher {
  /** claim_text must contain every one of these (case-insensitive). */
  textIncludes?: string[];
  /** actors must equal this set exactly (case-insensitive). [] = no actors. */
  actors?: string[];
  /** actors must include all of these (case-insensitive). */
  actorsInclude?: string[];
  claimType?: ReviewedClaim["claim_type"];
  creationMethod?: ReviewedClaim["creation_method"];
  status?: ReviewedClaim["status"];
}

export interface EvalExpectations {
  /** Each matcher must match at least one claim. */
  claims?: ClaimMatcher[];
  /** No claim may match any of these. */
  forbiddenClaims?: ClaimMatcher[];
  /** Every actor on every claim must be one of these. */
  allowedActors?: string[];
  maxClaims?: number;
  star?: "absent" | "present";
  /** true: at least one clarification question; false: none. */
  clarification?: boolean;
  /** Neither the summary nor the standup may contain these (case-insensitive). */
  outputMustNotMention?: string[];
}

export interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

const lc = (s: string) => s.trim().toLowerCase();

export function matchesClaim(claim: ReviewedClaim, m: ClaimMatcher): boolean {
  const text = lc(claim.claim_text);
  const actors = claim.actors.map(lc);
  if (m.textIncludes && !m.textIncludes.every((t) => text.includes(lc(t)))) return false;
  if (m.actors) {
    const want = m.actors.map(lc);
    if (want.length !== actors.length || !want.every((a) => actors.includes(a))) return false;
  }
  if (m.actorsInclude && !m.actorsInclude.every((a) => actors.includes(lc(a)))) return false;
  if (m.claimType && claim.claim_type !== m.claimType) return false;
  if (m.creationMethod && claim.creation_method !== m.creationMethod) return false;
  if (m.status && claim.status !== m.status) return false;
  return true;
}

export function describeMatcher(m: ClaimMatcher): string {
  return JSON.stringify(m);
}

function describeClaims(claims: ReviewedClaim[]): string {
  if (claims.length === 0) return "(no claims)";
  return claims.map((c) => `"${c.claim_text}" [${c.actors.join(", ") || "no actors"}]`).join("; ");
}

export function checkExpectations(
  e: EvalExpectations,
  analysis: CheckInAnalysis,
  claims: ReviewedClaim[],
): CheckResult[] {
  const results: CheckResult[] = [];

  for (const m of e.claims ?? []) {
    const hit = claims.find((c) => matchesClaim(c, m));
    results.push({
      name: `has claim ${describeMatcher(m)}`,
      pass: Boolean(hit),
      detail: hit ? `matched "${hit.claim_text}"` : `got ${describeClaims(claims)}`,
    });
  }

  for (const m of e.forbiddenClaims ?? []) {
    const hit = claims.find((c) => matchesClaim(c, m));
    results.push({
      name: `no claim ${describeMatcher(m)}`,
      pass: !hit,
      detail: hit ? `found "${hit.claim_text}" [${hit.actors.join(", ")}]` : "none found",
    });
  }

  if (e.allowedActors) {
    const allowed = e.allowedActors.map(lc);
    const bad = claims.filter((c) => c.actors.some((a) => !allowed.includes(lc(a))));
    results.push({
      name: `actors limited to [${e.allowedActors.join(", ")}]`,
      pass: bad.length === 0,
      detail: bad.length ? `violations: ${describeClaims(bad)}` : "ok",
    });
  }

  if (e.maxClaims !== undefined) {
    results.push({
      name: `at most ${e.maxClaims} claim(s)`,
      pass: claims.length <= e.maxClaims,
      detail: `got ${claims.length}: ${describeClaims(claims)}`,
    });
  }

  if (e.star) {
    const present = analysis.star_candidate !== null;
    results.push({
      name: `STAR candidate ${e.star}`,
      pass: e.star === "present" ? present : !present,
      detail: present ? `situation: ${analysis.star_candidate!.situation}` : "null",
    });
  }

  if (e.clarification !== undefined) {
    const n = analysis.clarifications_needed.length;
    results.push({
      name: e.clarification ? "asks for clarification" : "asks no clarification",
      pass: e.clarification ? n > 0 : n === 0,
      detail: n ? analysis.clarifications_needed.map((q) => q.question).join(" | ") : "none",
    });
  }

  if (e.outputMustNotMention) {
    const s = analysis.standup;
    const prose = lc([analysis.summary, ...s.completed, ...s.struggling, ...s.next].join(" \n "));
    const found = e.outputMustNotMention.filter((t) => prose.includes(lc(t)));
    results.push({
      name: `summary/standup avoid [${e.outputMustNotMention.join(", ")}]`,
      pass: found.length === 0,
      detail: found.length ? `mentions ${found.join(", ")}: "${analysis.summary}"` : "ok",
    });
  }

  return results;
}
