# ADR-002: OpenAI API as the LLM provider

**Status:** Accepted (2026-10-28). Resolves open decision OD-1.

ADR-001 (bounded historical context) is recorded in the application spec, §39.

## Problem

The check-in conversation and structured analysis need an LLM. The spec left the provider open (OpenAI vs. Gemini or another justified provider).

## Options considered

- **OpenAI API**: native JSON-schema Structured Outputs, and a Zod helper in the official SDK.
- **Gemini API**: comparable JSON-schema mode. On the free tier, Google may use prompts and responses to improve its products, which is a poor fit for personal or sponsor data.
- **Anthropic API**: comparable structured output support. Not one of the spec's original options.

## Decision

Use the OpenAI API, called **only from server-side code** (Next.js route handlers or server actions). The API key lives in `.env.local` and is never sent to the browser.

## Important clarification: ChatGPT Edu ≠ OpenAI API

Madie's ASU ChatGPT Edu workspace is a separate product governed by ASU's agreement with OpenAI. **Those protections do not extend to a personal OpenAI API account**, which is governed by OpenAI's standard API terms. At the time of this decision, API data is not used for training by default and may be retained for a limited period for abuse monitoring. Check OpenAI's current data-usage policy rather than relying on this note.

**Consequence:** Do not send sponsor-confidential or restricted material to the API unless that is permitted. Check with the sponsor and ASU if in doubt. This matters most in Milestone 4 (document ingestion).

## Tradeoffs

- Speaker values stay `Madie` / `ChatGPT` as written in the spec.
- Structured Outputs reduce malformed JSON but do not guarantee correct *content*. The app still validates with Zod and applies its own integrity checks (for example CE-4).
- Provider lock-in is limited by isolating OpenAI calls behind one small module (`src/lib/llm/`, slice 1b).

## Impact

Slice 1b adds the `openai` and `zod` packages and an `OPENAI_API_KEY` server environment variable.
