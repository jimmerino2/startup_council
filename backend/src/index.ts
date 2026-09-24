import "./env.js";
import express from "express";
import cors from "cors";
import { sessionsRouter } from "./routes/sessions.js";
import { judgeRouter } from "./routes/judge.js";
import { uploadRouter } from "./routes/upload.js";
import { settingsRouter } from "./routes/settings.js";

const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "API_KEY_ENCRYPTION_SECRET"];
const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.warn(`Warning: missing env vars: ${missing.join(", ")}. See .env.example.`);
}

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/sessions", sessionsRouter);
app.use("/api/sessions", judgeRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/settings", settingsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    console.log(`Startup Council API listening on http://localhost:${port}`);
  });
}
