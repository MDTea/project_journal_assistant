import { REFLECTION_CATEGORIES } from "../../src/lib/checkin/categories";
import { createSession, submitInput } from "../../src/lib/checkin/flow";
import type { CategoryId, CheckInStatement } from "../../src/lib/checkin/types";
import type { EvalExpectations } from "./expect";

// LLM evaluation cases (handoff §16). Every case is fictional test data.
// Add a case whenever a real check-in reveals a new failure mode.

export interface EvalCase {
  id: string;
  /** What this case is probing, in one line. */
  probes: string;
  statements: CheckInStatement[];
  expect: EvalExpectations;
}

const FIXED_NOW = new Date(2026, 9, 29, 17, 0);

/** Build a realistic transcript by running answers through the real check-in flow. */
function scripted(opening: string, answers: Partial<Record<CategoryId, string>> = {}) {
  let s = submitInput(createSession(), "Start", FIXED_NOW);
  const inputs = [opening, ...REFLECTION_CATEGORIES.map((c) => answers[c.id] ?? "N/A")];
  for (const input of inputs) {
    if (!s.ok) break;
    s = submitInput(s.session, input, FIXED_NOW);
  }
  if (!s.ok) throw new Error(`bad eval transcript: ${s.error}`);
  return s.session.statements;
}

/** Hand-built transcript, for cases the scripted assistant cannot produce. */
function raw(turns: [CheckInStatement["speaker"], string][]): CheckInStatement[] {
  return turns.map(([speaker, statement_text], i) => ({
    statement_order: i + 1,
    speaker,
    statement_text,
    created_at: FIXED_NOW.toISOString(),
  }));
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: "personal-ownership",
    probes: "Clear first-person ownership is attributed to Madie.",
    statements: scripted("I implemented the login form validation in React."),
    expect: {
      claims: [{ textIncludes: ["validation"], actors: ["Madie"], claimType: "ownership_responsibility" }],
      allowedActors: ["Madie"],
    },
  },
  {
    id: "team-ownership",
    probes: "An explicit whole-team decision is attributed to the team, not Madie.",
    statements: scripted("Today the whole team decided to use Supabase instead of Firebase."),
    expect: {
      claims: [{ textIncludes: ["supabase"], actors: ["project team"], claimType: "decision" }],
      forbiddenClaims: [{ textIncludes: ["supabase"], actorsInclude: ["Madie"] }],
    },
  },
  {
    id: "teammate-ownership",
    probes: "A teammate's work is not credited to Madie.",
    statements: scripted("Mostly code review today. Jordan set up the GitHub Actions CI pipeline."),
    expect: {
      claims: [{ textIncludes: ["pipeline"], actors: ["Jordan"] }],
      forbiddenClaims: [{ textIncludes: ["pipeline"], actorsInclude: ["Madie"] }],
    },
  },
  {
    id: "ambiguous-we",
    probes: "An ambiguous 'we' is not resolved by guessing; a clarification is requested.",
    statements: scripted("We fixed the deployment bug that was breaking the preview builds."),
    expect: {
      allowedActors: ["Madie"],
      clarification: true,
    },
  },
  {
    id: "quantitative-no-actor",
    probes: "An actor-less quantitative result gets zero actors.",
    statements: scripted("Ran the load test against staging.", {
      completed: "95 of 100 requests completed in under 2 seconds.",
    }),
    expect: {
      claims: [{ textIncludes: ["95"], actors: [], claimType: "quantitative_event" }],
    },
  },
  {
    id: "passive-statement",
    probes: "A passive statement does not gain an inferred actor.",
    statements: scripted("Worked on documentation.", { completed: "The README got updated." }),
    expect: {
      forbiddenClaims: [{ textIncludes: ["readme"], actorsInclude: ["Madie"] }],
      outputMustNotMention: ["updated the readme"],
    },
  },
  {
    id: "multiple-atomic",
    probes: "One sentence with three actors becomes separate atomic claims.",
    statements: scripted(
      "I wrote the API docs while Priya built the dashboard and Sam reviewed my pull request.",
    ),
    expect: {
      claims: [
        { textIncludes: ["docs"], actors: ["Madie"] },
        { textIncludes: ["dashboard"], actors: ["Priya"] },
        { textIncludes: ["review"], actors: ["Sam"] },
      ],
    },
  },
  {
    id: "joint-work",
    probes: "Explicit joint work is one claim with both actors.",
    statements: scripted("Jordan and I debugged the authentication redirect together."),
    expect: {
      claims: [{ textIncludes: ["debug"], actors: ["Madie", "Jordan"] }],
    },
  },
  {
    id: "non-claim-chatter",
    probes: "Conversational content without ownership, decisions or numbers yields no claims.",
    statements: scripted("Not much honestly, I was tired and mostly thought about the project.", {
      struggled: "Motivation, I guess.",
    }),
    expect: { maxClaims: 0, star: "absent" },
  },
  {
    id: "user-designated",
    probes: "An explicit request to record a claim is honored and marked user_designated.",
    statements: scripted(
      "Please record this as a claim: I am the team's point of contact for the sponsor.",
    ),
    expect: {
      claims: [{ textIncludes: ["point of contact"], actors: ["Madie"], creationMethod: "user_designated" }],
    },
  },
  {
    id: "ai-ownership-assumption",
    probes: "Ownership suggested only by the assistant never becomes a supported claim (CE-4).",
    statements: raw([
      ["ChatGPT", "Hi, what did you do today for your project?"],
      ["Madie", "I helped test the auth module."],
      ["ChatGPT", "So you built the whole auth module yourself?"],
      ["Madie", "I'd rather not say more about that."],
      ["ChatGPT", "Thanks, that covers today."],
    ]),
    expect: {
      claims: [{ textIncludes: ["test"], actorsInclude: ["Madie"] }],
      forbiddenClaims: [{ textIncludes: ["built"], actorsInclude: ["Madie"], status: "supported" }],
      outputMustNotMention: ["built the"],
    },
  },
  {
    id: "no-career-evidence",
    probes: "A routine day yields no STAR story.",
    statements: scripted("Attended standup and read through the sponsor's requirements doc.", {
      goal: "Finish reading the requirements.",
    }),
    expect: { star: "absent" },
  },
  {
    id: "star-warranted",
    probes: "A real problem-action-result-learning story yields a STAR candidate (positive control).",
    statements: scripted(
      "Our deploys had been failing for two days. I traced it to a missing environment variable in CI.",
      {
        completed: "I wrote a script that checks required config before deploy; deploys pass again.",
        learning: "Validate configuration early instead of debugging runtime failures.",
        proud: "I stuck with the debugging until I found the root cause.",
      },
    ),
    expect: { star: "present" },
  },
  {
    id: "skips-not-filled",
    probes: "Skipped categories are not filled with invented content.",
    statements: scripted("Short day. I renamed a few components.", {
      struggled: "Skip",
      collaboration: "Nothing new",
    }),
    expect: {
      allowedActors: ["Madie"],
      maxClaims: 2,
      star: "absent",
      // Phrases that would assert collaboration happened. Merely noting that
      // none was reported ("no collaboration updates") is acceptable.
      outputMustNotMention: ["teammate", "worked with", "paired", "with the team"],
    },
  },
];
