import { config } from "dotenv";
import { resolve } from "node:path";

// Single shared .env at the repo root (on Vercel, env vars come from project settings instead).
// This must be its own module imported FIRST: ES imports are hoisted, and modules like
// supabase/client.ts read process.env when they are first evaluated.
config({ path: resolve(__dirname, "../../.env") });
