import { z } from "zod";

// Zod schemas for slice 1b (handoff §15). One schema does two jobs:
//   1. it is converted to JSON Schema and sent to OpenAI as the required
//      output shape (Structured Outputs, strict mode), and
//   2. the SDK parses the model's reply with it before our code sees it.
// Strict mode requires every field to be present, so "maybe absent"
// values are modeled as .nullable() rather than .optional().

export const CLAIM_TYPES = [
  "ownership_responsibility",
  "decision",
  "quantitative_event",
  "other",
] as const;

/** user_clarification is not produced until Milestone 3 (ClaimResolution). */
export const EXTRACTION_METHODS = ["auto_extracted", "user_designated"] as const;

export const ExtractedClaimSchema = z.object({
  claim_text: z.string().describe("The full natural-language claim, e.g. 'Madie wrote the validation logic.'"),
  actors: z
    .array(z.string())
    .describe("Who performed the action. Empty for quantitative results with no actor."),
  verb: z.string(),
  direct_object: z.string(),
  context: z.string().nullable(),
  claim_type: z.enum(CLAIM_TYPES),
  creation_method: z.enum(EXTRACTION_METHODS),
  supporting_statement_orders: z
    .array(z.number().int())
    .describe("statement_order numbers of the Madie statements that state this claim."),
});

export const StarCandidateSchema = z.object({
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  learning: z.string(),
});

export const ClarificationSchema = z.object({
  question: z.string(),
  statement_orders: z.array(z.number().int()),
});

export const CheckInAnalysisSchema = z.object({
  claims: z.array(ExtractedClaimSchema),
  standup: z.object({
    completed: z.array(z.string()),
    struggling: z.array(z.string()),
    next: z.array(z.string()),
  }),
  summary: z.string().describe("3-6 sentence daily reflection."),
  star_candidate: StarCandidateSchema.nullable().describe(
    "null unless the check-in contains a meaningful, evidence-backed story.",
  ),
  clarifications_needed: z
    .array(ClarificationSchema)
    .describe("Questions for Madie where ownership or facts are ambiguous."),
});

export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;
export type StarCandidate = z.infer<typeof StarCandidateSchema>;
export type CheckInAnalysis = z.infer<typeof CheckInAnalysisSchema>;

// Request body for POST /api/analyze. The browser is untrusted input, so the
// server validates the transcript before building a prompt from it.
export const CheckInStatementSchema = z.object({
  statement_order: z.number().int().positive(),
  speaker: z.enum(["Madie", "ChatGPT"]),
  statement_text: z.string().max(10_000),
  created_at: z.string(),
});

export const AnalyzeRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  statements: z.array(CheckInStatementSchema).min(1).max(200),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
