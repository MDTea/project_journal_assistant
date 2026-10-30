import type { CheckInStatement } from "../checkin/types";
import type { ExtractedClaim } from "./schema";

// Deterministic checks applied to the LLM's claims *after* Zod validation.
// Zod guarantees the shape; these rules check the content against the
// actual transcript, in application code rather than prompt instructions.
//
// Status is assigned here, never by the model:
//   supported  - at least one cited Madie statement backs the claim
//   unresolved - no valid Madie evidence (missing, invented, or assistant-only)

export type ReviewClaimStatus = "supported" | "unresolved";

export interface ReviewedClaim extends ExtractedClaim {
  status: ReviewClaimStatus;
  /** Only the cited statements that exist and were spoken by Madie. */
  evidence_statement_orders: number[];
  flags: string[];
}

export function reviewClaims(
  claims: ExtractedClaim[],
  statements: CheckInStatement[],
): ReviewedClaim[] {
  const byOrder = new Map(statements.map((s) => [s.statement_order, s]));

  return claims.map((claim) => {
    const flags: string[] = [];
    const evidence: number[] = [];

    for (const order of new Set(claim.supporting_statement_orders)) {
      const statement = byOrder.get(order);
      if (!statement) {
        flags.push(`Cites statement #${order}, which does not exist in this check-in.`);
      } else if (statement.speaker !== "Madie") {
        // CE-4: an assistant statement cannot independently establish a fact.
        flags.push(`Cites assistant statement #${order}; assistant statements are not evidence.`);
      } else {
        evidence.push(order);
      }
    }

    if (claim.supporting_statement_orders.length === 0) {
      flags.push("No supporting statement cited.");
    }

    return {
      ...claim,
      actors: dedupe(claim.actors),
      status: evidence.length > 0 ? "supported" : "unresolved",
      evidence_statement_orders: evidence.sort((a, b) => a - b),
      flags,
    };
  });
}

function dedupe(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}
