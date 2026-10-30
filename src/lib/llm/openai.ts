import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { CheckInAnalysisSchema, type CheckInAnalysis } from "../analysis/schema";
import type { CheckInStatement } from "../checkin/types";
import { ANALYSIS_INSTRUCTIONS, buildAnalysisInput } from "./prompt";

// The only module that talks to OpenAI. "server-only" makes the build fail
// if a client component ever imports it, so the API key cannot leak into
// the browser bundle.

const DEFAULT_MODEL = "gpt-5.4-mini";

export class LlmConfigError extends Error {}
export class LlmOutputError extends Error {}

export function analysisModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

export async function analyzeCheckIn(
  date: string,
  statements: CheckInStatement[],
): Promise<CheckInAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new LlmConfigError("OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server.");
  }

  const client = new OpenAI(); // reads OPENAI_API_KEY from the environment
  const response = await client.responses.parse({
    model: analysisModel(),
    instructions: ANALYSIS_INSTRUCTIONS,
    input: buildAnalysisInput(date, statements),
    text: { format: zodTextFormat(CheckInAnalysisSchema, "checkin_analysis") },
    store: false, // don't keep the response on OpenAI's side for later retrieval
  });

  // output_parsed has already passed CheckInAnalysisSchema. It is null only
  // when the model refused or returned no parseable output.
  if (!response.output_parsed) {
    throw new LlmOutputError("The model did not return a usable analysis.");
  }
  return response.output_parsed;
}

/** A safe, user-facing message for known provider errors; null otherwise. */
export function describeLlmError(err: unknown): string | null {
  if (err instanceof LlmConfigError || err instanceof LlmOutputError) return err.message;
  if (!(err instanceof OpenAI.APIError)) return null;
  if (err.code === "insufficient_quota" || err.code === "credit_balance_exhausted") {
    return "Your OpenAI API account has no credits. Add credits at platform.openai.com → Billing.";
  }
  if (err.status === 401) return "OpenAI rejected the API key. Check OPENAI_API_KEY in .env.local.";
  if (err.status === 404) return `Model "${analysisModel()}" is not available to this API key.`;
  if (err.status === 429) return "OpenAI rate limit hit. Wait a moment and try again.";
  return null;
}
