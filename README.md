# Project Journal Assistant

The CIS 591 Journal Assistant is a private, human-controlled AI journaling application designed to help me document, understand, and later explain my work on the CIS 591 project.

**Core principle:** Evidence → AI interpretation → my review/clarification → approved documentation. Generated prose never becomes authoritative just because an LLM wrote it.

## Current status

**Milestone 1, slice 1a: scripted check-in (no LLM yet).**

| Slice | Scope | Status |
|---|---|---|
| 1a | Next.js scaffold, "Start", seven reflection categories asked in order, in-memory transcript, coverage summary | Done |
| 1b | OpenAI structured analysis (Zod-validated): Claims, standup, reflection, optional STAR, review screen | Next |
| 1c | LLM-driven conversation with useful follow-up questions | Planned |

Not in Milestone 1: Supabase, Google Docs, file upload, authentication, background jobs, vector search. See [Documentation/milestone-1.md](Documentation/milestone-1.md).

## Run it locally

Requires Node.js 20.9+ (developed on Node 24).

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run lint
```

Slice 1b will need an OpenAI API key: copy `.env.example` to `.env.local` and fill it in. `.env.local` is git-ignored and must never be committed.

## Repository layout

```text
Documentation/
  ApplicationSpec_v0.1           Product specification (source of truth)
  proj_poe_v0.2_temporarilyfrozen.png   ERD, Schema v0.2 (temporarily frozen)
  milestone-1.md                 Milestone 1 scope and slice plan
  decisions/                     Architecture Decision Records (ADRs)
src/
  app/                           Next.js App Router pages
  components/CheckInChat.tsx     Check-in chat UI (client component)
  lib/checkin/                   Pure check-in logic (no React, no I/O)
tests/                           Vitest unit tests
```

## Stack

Next.js 16 + TypeScript · Zod (from slice 1b) · OpenAI API ([ADR-002](Documentation/decisions/ADR-002-llm-provider-openai.md)) · Supabase/PostgreSQL (Milestone 2) · Google Docs API (Milestone 5) · Vercel + GitHub Actions (Milestone 6).
