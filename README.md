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

### 2. Backend

```bash
cd backend
cp .env.example .env   # fill in OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
npm install
npm run dev             # http://localhost:3001
```

Get a free OpenRouter API key at https://openrouter.ai/keys. The default persona→model mapping
in `.env.example` uses free (`:free`) models as of setup time — verify current availability at
https://openrouter.ai/models?max_price=0 and override any `OPENROUTER_MODEL_*` var if a slug has
been retired.

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm install
npm run dev             # http://localhost:5173
```

## Deploying to Vercel

Create **two** Vercel projects from this repo:

| Project | Root Directory | Env vars |
| --- | --- | --- |
| API | `backend` | `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CORS_ORIGIN` (the frontend's URL), optional `OPENROUTER_MODEL_*` |
| Web | `frontend` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (the API project's URL) |

Then add the frontend URL to Supabase → Authentication → URL Configuration (Site URL and Redirect URLs).

Judging is asynchronous: `POST /api/sessions/:id/judge` returns 202 and the council runs via `waitUntil`
(function `maxDuration` is 300s in `backend/vercel.json`; your plan must allow that). The results page polls
until the session leaves `pending`/`judging`. Uploads are capped at 4MB (Vercel's request body limit).

## Project structure

```
backend/    Express API: auth middleware, session CRUD, file parsing, council orchestration
frontend/   Vue app: auth, new session form, results view, session history
supabase/   SQL migrations + local dev config
```
