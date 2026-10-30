"use client";

import { useEffect, useRef, useState } from "react";
import { REFLECTION_CATEGORIES } from "@/lib/checkin/categories";
import { createSession, submitInput } from "@/lib/checkin/flow";
import styles from "./CheckInChat.module.css";

export default function CheckInChat() {
  const [session, setSession] = useState(createSession);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const inProgress = session.phase === "opening" || session.phase === "categories";
  const isComplete = session.phase === "complete";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.statements.length]);

  // Milestone 1 has no persistence, so warn before a reload discards answers.
  useEffect(() => {
    if (!inProgress) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inProgress]);

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
          <p className={styles.note}>
            Next slice (1b): send this transcript to the LLM for structured analysis (claims,
            standup, reflection, optional STAR) and review it here.
          </p>
        </div>
      )}

      {session.phase !== "awaiting_start" && (
        <button type="button" className={styles.reset} onClick={handleReset}>
          {isComplete ? "Start a new check-in" : "Discard check-in"}
        </button>
      )}
    </section>
  );
}
