# Startup Council

A minimal-UI council of free OpenRouter LLM personas that judges startup/hackathon ideas
against user-supplied judging criteria.

- **Frontend**: Vue 3 + Vite + TypeScript + Pinia
- **Backend**: Express + TypeScript
- **Database/Auth**: Supabase (Postgres + Row Level Security, email magic-link auth)
- **Models**: free-tier OpenRouter models (`:free` suffix), one per persona, configurable via env vars

## How judging works

1. User signs in (Supabase magic link) and submits a problem statement, judging criteria, and
   a pitch (pasted text or uploaded PDF/DOCX/MD/TXT, parsed server-side).
2. **Stage 1** — six personas (Judge, Skeptic, Optimist, Market Analyst, Technical Feasibility
   Lead, VC Investor) each independently score the submission in parallel (6 OpenRouter calls).
3. **Stage 2** — a Chairman model reads all six verdicts and synthesizes a final score and
   recommendation (Fund / Iterate / Pass) (1 OpenRouter call).
4. Results are persisted to Supabase, scoped to the signed-in user via RLS.

This is a 2-stage council (no pairwise peer-review round) by design, to stay well within
OpenRouter's free-tier rate limits — 7 calls per judged idea instead of 40+.

## Setup

### 1. Supabase

Install the Supabase CLI, then from the repo root:

```bash
supabase login
supabase link --project-ref <your-project-ref>   # or `supabase start` for local dev
supabase db push                                  # applies supabase/migrations/0001_init.sql
```

In the Supabase dashboard, grab your project URL, anon key, and (for local dev convenience)
confirm email confirmations are disabled if you want magic links to work without an SMTP setup
(already configured for local dev in `supabase/config.toml`).

### 2. Environment and run

One shared `.env` at the repo root configures both apps locally (the backend loads it directly; Vite
reads it via `envDir`, exposing only `VITE_`-prefixed vars to the browser).

```bash
cp .env.example .env   # fill in OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, VITE_SUPABASE_*
npm install && npm run install:all
npm run dev             # backend http://localhost:3001 + frontend http://localhost:5173
```

Get a free OpenRouter API key at https://openrouter.ai/keys. The default persona→model mapping
in `backend/src/config/personas.ts` uses free (`:free`) models as of setup time — verify current availability at
https://openrouter.ai/models?max_price=0 and change the slug there (or per role on the Settings page) if one has
been retired.

## Deploying to Vercel

One Vercel project, one deployment, using [Vercel Services](https://vercel.com/docs/services): the root
`vercel.json` defines a `frontend` service (served at `/`) and a `backend` service (Express, served at `/api`).
Import the repo and choose the **Services** preset.

Vercel does not read `.env` files. Add these in the project's Environment Variables settings:
`OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Leave `VITE_API_BASE_URL` empty (same origin) and `CORS_ORIGIN` unset.

Then add the deployed URL to Supabase → Authentication → URL Configuration (Site URL and Redirect URLs).
Sanity check after deploying: `https://<your-domain>/api/health` should return `{"ok":true}`.

Judging is asynchronous: `POST /api/sessions/:id/judge` returns 202 and the council runs via `waitUntil`
(`maxDuration` is 300s for the backend service in `vercel.json`; your plan must allow that). The results page
polls until the session leaves `pending`/`judging`. Uploads are capped at 4MB (Vercel's request body limit).

## Supabase setup after deploying

Do these once you have the deployed URL (referred to as `https://<your-domain>`):

1. **Apply the database migration** to the hosted project (skip if already done):
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   In Supabase → Table Editor, confirm `sessions`, `persona_verdicts` and `chairman_verdicts` exist with
   RLS enabled.

2. **Configure the auth URLs** in Supabase → Authentication → URL Configuration:
   - **Site URL:** `https://<your-domain>`
   - **Redirect URLs:** add `https://<your-domain>/**`. Keep `http://localhost:5173/**` for local dev, and add
     `https://*-<your-vercel-team>.vercel.app/**` if you want magic links to work on preview deployments.

   The app sends `emailRedirectTo: window.location.origin`, so the origin the user signed in from must be in this
   list or the magic link falls back to the Site URL.

3. **Check the email provider** in Authentication → Providers → Email (enabled). Supabase's built-in email sender is
   heavily rate-limited (a few emails per hour), so for real users configure custom SMTP under
   Authentication → Emails → SMTP Settings.

4. **Use only the public key** in Vercel. `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY` are the anon/publishable
   key from Project Settings → API. Never add the service-role/secret key; the app doesn't use it and RLS
   depends on requests carrying the user's token, not an admin key.

5. **Redeploy** if you changed any environment variable. `VITE_*` values are baked in at build time.

6. **Verify end to end:** open `https://<your-domain>/api/health` (expect `{"ok":true}`), sign in with a magic
   link, submit a session, and confirm rows appear in `sessions`, `persona_verdicts` and `chairman_verdicts`.
   Signing in as a second user should show none of the first user's sessions.

## Project structure

```
backend/    Express API: auth middleware, session CRUD, file parsing, council orchestration
frontend/   Vue app: auth, new session form, results view, session history
supabase/   SQL migrations + local dev config
```
