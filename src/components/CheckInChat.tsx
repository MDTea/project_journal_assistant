"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalyzeResponse } from "@/app/api/analyze/route";
import { REFLECTION_CATEGORIES } from "@/lib/checkin/categories";
import { createSession, submitInput } from "@/lib/checkin/flow";
import AnalysisReview from "./AnalysisReview";
import styles from "./CheckInChat.module.css";

export default function CheckInChat() {
  const [session, setSession] = useState(createSession);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const inProgress = session.phase === "opening" || session.phase === "categories";
  const isComplete = session.phase === "complete";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.statements.length]);

  // Milestone 1 has no persistence, so warn before a reload discards answers.
  useEffect(() => {
    if (session.statements.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [session.statements.length]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: session.date, statements: session.statements }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setAnalysis(data as AnalyzeResponse);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = submitInput(session, draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSession(result.session);
    setDraft("");
    setError(null);
  }

  function handleReset() {
    if (session.statements.length > 0 && !window.confirm("Discard this check-in?")) return;
    setSession(createSession());
    setDraft("");
    setError(null);
    setAnalysis(null);
    setAnalysisError(null);
  }

  return (
    <section className={styles.chat}>
      {session.date && (
        <div className={styles.meta}>
          <span>Check-in · {session.date}</span>
          {inProgress && session.phase === "categories" && (
            <span>
              Category {session.currentCategoryIndex + 1} of {REFLECTION_CATEGORIES.length}
            </span>
          )}
        </div>
      )}

      <ol className={styles.messages}>
        {session.phase === "awaiting_start" && (
          <li className={styles.hint}>Type “Start” when you are ready to check in.</li>
        )}
        {session.statements.map((s) => (
          <li
            key={s.statement_order}
            className={s.speaker === "Madie" ? styles.madie : styles.assistant}
          >
            <span className={styles.speaker}>{s.speaker}</span>
            <p>{s.statement_text}</p>
          </li>
        ))}
      </ol>
      <div ref={bottomRef} />

      {!isComplete && (
        <form className={styles.composer} onSubmit={handleSubmit}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
            }}
            placeholder={
              session.phase === "awaiting_start"
                ? "Start"
                : "Your answer (N/A, Skip, or Nothing new are fine)"
            }
            rows={3}
            aria-label="Your message"
          />
          <button type="submit">Send</button>
        </form>
      )}
      {error && <p className={styles.error}>{error}</p>}

      {isComplete && (
        <div className={styles.review}>
          <h2>Coverage</h2>
          <ul className={styles.coverage}>
            {REFLECTION_CATEGORIES.map((c) => (
              <li key={c.id}>
                <span>{c.question}</span>
                <span className={styles.status}>{session.categoryStatus[c.id] ?? "—"}</span>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <button type="button" onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze check-in"}
            </button>
            <span className={styles.note}>Sends this transcript to OpenAI.</span>
          </div>
          {analysisError && <p className={styles.error}>{analysisError}</p>}
        </div>
      )}

      {isComplete && analysis && (
        <AnalysisReview result={analysis} statements={session.statements} />
      )}

      {session.phase !== "awaiting_start" && (
        <button type="button" className={styles.reset} onClick={handleReset}>
          {isComplete ? "Start a new check-in" : "Discard check-in"}
        </button>
      )}
    </section>
  );
}
