import { resolve } from "node:path";

// Single shared .env at the repo root (on Vercel, env vars come from project settings instead).
// This must be its own module imported FIRST: ES imports are hoisted, and modules like
// supabase/client.ts read process.env when they are first evaluated.
// dotenv is only needed locally, so it's loaded lazily and skipped on Vercel.
if (!process.env.VERCEL) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("dotenv").config({ path: resolve(__dirname, "../../.env") });
  } catch {
    // dotenv not installed; rely on the real environment.
  }
}
