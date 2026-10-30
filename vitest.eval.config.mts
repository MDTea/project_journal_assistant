import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// LLM evals: real OpenAI calls, so they cost money and are NOT part of
// `npm test`. Run explicitly with `npm run eval`.

const envFile = fileURLToPath(new URL(".env.local", import.meta.url));
const env = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("tests/evals/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/evals/**/*.eval.ts"],
    env,
    silent: false,
    hookTimeout: 120_000,
    testTimeout: 120_000,
  },
});
