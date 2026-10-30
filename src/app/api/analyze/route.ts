import { NextResponse } from "next/server";
import { reviewClaims, type ReviewedClaim } from "@/lib/analysis/integrity";
import { AnalyzeRequestSchema, type CheckInAnalysis } from "@/lib/analysis/schema";
import { analysisModel, analyzeCheckIn, describeLlmError } from "@/lib/llm/openai";

export interface AnalyzeResponse {
  date: string;
  model: string;
  analysis: CheckInAnalysis;
  claims: ReviewedClaim[];
}

// POST /api/analyze
// Browser sends the in-memory transcript; the server calls OpenAI, then
// applies deterministic integrity checks before returning anything.
export async function POST(request: Request) {
  const body = AnalyzeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid check-in transcript." }, { status: 400 });
  }
  const { date, statements } = body.data;

  if (!statements.some((s) => s.speaker === "Madie")) {
    return NextResponse.json({ error: "The check-in has no answers to analyze." }, { status: 400 });
  }

  try {
    const analysis = await analyzeCheckIn(date, statements);
    const result: AnalyzeResponse = {
      date,
      model: analysisModel(),
      analysis,
      claims: reviewClaims(analysis.claims, statements),
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("analyze failed:", err);
    // Don't forward raw provider errors to the browser; map known ones.
    return NextResponse.json(
      { error: describeLlmError(err) ?? "Analysis failed. Check the dev server logs for details." },
      { status: 502 },
    );
  }
}
