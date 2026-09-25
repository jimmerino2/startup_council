# Startup Council

A council of LLM personas that judges startup/hackathon ideas against user-supplied judging criteria.
Each persona can request real-world evidence, the personas review each other anonymously, and a Chairman
makes the final call. Every stage after submission is visible on the results page.

- **Frontend**: Vue 3 + Vite + TypeScript + Pinia
- **Backend**: Express + TypeScript
- **Database/Auth**: Supabase (Postgres + Row Level Security, email magic-link auth)
- **Models**: bring your own provider per role. OpenRouter (free `:free` models work out of the box), Gemini,
  Mistral, Groq and Gonkarouter are supported, configured on the Settings page. API keys are stored encrypted.

## How judging works

The user signs in (Supabase magic link) and submits a problem statement, judging criteria, and a pitch
(pasted text, or an uploaded PDF/DOCX/MD/TXT parsed server-side). The council then runs in four steps.
Submitting the form only creates the session. Each of the four steps then waits for the user to press a button, so the user can
review and retry the previous step first. Every step can be retried where a model call may time out or fail.

### Step 1: Gather evidence (button: "Start gathering evidence")

1. **Requests.** Each of the six personas (Judge, Skeptic, Optimist, Market Analyst, Technical Feasibility
   Lead, Reality Checker) reads the submission and lists up to *N* documents or data points it needs, such as market
   reports, competitor financials or regulations. *N* is a per-user setting (0 to 5, default 1; 0 skips this step).
2. **Merge duplicates.** Requests from different personas (or twice from the same one) whose wording largely overlaps are
   merged into one, so it is searched, downloaded and read once and every persona that asked receives the result.
3. **Find.** The *clerk* model searches the web for each request. The clerk must be a model with built-in web
   search, so only **OpenRouter** (web plugin) and **Gemini** (Google Search grounding) can be chosen for it. The
   Settings page, the API and the model call all enforce this. Source links are the provider's own citations, never
   URLs the model wrote, so a persona can only ever cite pages that were actually retrieved.
4. **Fetch.** The server downloads one document per request (HTML, PDF or DOCX): it tries the cited sources in order, up to three, and stops at the first that downloads and stores the
   extracted text (capped at 30,000 characters) in `evidence_documents`. Downloads only accept public `http(s)` addresses: private and internal
   IPs, non-standard ports and credentials in links are refused, redirects are re-checked, and size and time are
   capped. The binary files themselves are not stored, only their extracted text.
5. **Extract.** The clerk reads the downloaded text and pulls out only the facts relevant to the request. That
   derived summary is what the personas receive, never the raw document. Extraction can be switched off in Settings to
   save calls: nothing is downloaded and the clerk's search summary is used as-is.

Every request ends in an explicit, stored outcome, so nothing comes back empty:

| Status | Meaning |
| --- | --- |
| extracted | facts were extracted from the downloaded documents |
| summary only | sources were found but could not be downloaded or did not contain the answer, so the clerk's search summary is kept |
| nothing found | the search returned no citable sources |
| failed | a model call errored or timed out; retry it |

Any request that is not "extracted" can be retried individually, and so can a persona whose request list failed.
Evidence is locked once step 2 starts. The stage has a 120 second budget; unfinished requests are marked failed
and can be retried one at a time.

### Step 2: Initial verdicts (button: "Proceed to initial verdicts")

The six personas score the submission in parallel, each using the evidence it requested. A failed persona can
be retried on its own.

### Step 3: Anonymous peer review (button: "Proceed to peer review")

Each persona sees the other five verdicts labelled Response A to E, in a shuffled order, with names and models
hidden, plus the derived evidence (labelled without persona names, so the review stays anonymous). It writes a
short critique and ranks them best to worst. The rankings are mapped back to personas on the server and
averaged. In Settings you can choose whether reviewers see **all** evidence (default) or only **their own**, which
gives smaller prompts and suits free models that time out. A failed review can be retried on its own. Re-running a
persona's verdict clears the reviews, since they were written against the old verdict.

### Step 4: Chairman (button: "Run chairman")

The Chairman reads the verdicts, all the evidence, the average peer ranking and every critique, then produces the
final score and recommendation (Fund / Iterate / Pass). If the chosen model fails, it falls back to other
OpenRouter models, and it can be retried.

Results are persisted to Supabase and scoped to the signed-in user via RLS.

**Cost per judged idea.** Model calls at the default of 1 evidence request per persona, before merging duplicates:

| Step | Calls |
| --- | --- |
| 1: request lists | 6 |
| 1: clerk search | up to 6 |
| 1: extraction | up to 6 (0 if extraction is off) |
| 2: verdicts | 6 |
| 3: peer reviews | 6 |
| 4: chairman | 1 |

That is about 31 calls, or 25 with extraction off. With 2 requests per persona it is up to 43. Merging duplicate requests
lowers the search and extraction counts further. A standard council with no evidence is about 13. Mind free-tier rate limits:
Gemini and OpenRouter calls are spaced out per API key, and after a 429 the key is parked while other keys
carry on (or, with a single key, every call pauses for the time the API asks, up to 30s). Adding more keys is the most
effective way to avoid rate limits. OpenRouter's web search
consumes credits even when the model itself is free.

## Settings

The Settings page (`/settings`) lets each user choose, per role, a provider and model, and save API keys
(encrypted server-side, see below). Roles: the six personas, the Chairman, and the **Evidence clerk**. It also sets how many
evidence requests each persona may file, whether the clerk reads the downloaded documents, and how much evidence peer
reviewers see. Leaving a model on "system
default" uses the defaults in `backend/src/config/personas.ts`; verify current free-model availability at
https://openrouter.ai/models?max_price=0 and change the slug there if one has been retired.

### Multiple API keys per provider

Each provider (OpenRouter, Gemini, Mistral, Groq, Gonkarouter) can have several keys, each with a name. Keys are added,
disabled, re-enabled and deleted on the Settings page and take effect immediately. Calls alternate between a provider's usable
keys (round robin), which spreads the load across their separate rate limits.

Each key has a status, stored in `provider_api_keys` so every request sees it:

| Status | Meaning |
| --- | --- |
| active | in rotation |
| limited | hit a rate limit or ran out of quota; skipped until `limited_until`, then it rejoins automatically |
| disabled | turned off by you, or rejected by the provider as invalid |

When a call fails because of its key, the next key takes over straight away and the failed key is parked:
- **Rate limit (429):** parked for the wait time the API reports (60 seconds if it doesn't say).
- **Daily quota or out of credits (OpenRouter 402):** parked until the quota is expected to reset (midnight Pacific for
  Gemini, midnight UTC for the others).
- **Invalid key (401):** disabled, with the provider's message shown next to the key.

With only one usable key left, calls wait out short rate limits as before. If every key is limited or disabled, the call fails
with a message saying when the next key becomes available. Keys you saved before this feature were copied over as "Default".

## Setup

### 1. Supabase

Install the Supabase CLI, then from the repo root:

```bash
supabase login
supabase link --project-ref <your-project-ref>   # or `supabase start` for local dev
supabase db push                                  # applies every file in supabase/migrations/
```

In the Supabase dashboard, grab your project URL, anon key, and (for local dev convenience)
confirm email confirmations are disabled if you want magic links to work without an SMTP setup
(already configured for local dev in `supabase/config.toml`).

### 2. Environment and run

One shared `.env` at the repo root configures both apps locally (the backend loads it directly; Vite
reads it via `envDir`, exposing only `VITE_`-prefixed vars to the browser).

```bash
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_ANON_KEY, API_KEY_ENCRYPTION_SECRET, VITE_SUPABASE_*
npm install && npm run install:all
npm run dev             # backend http://localhost:3001 + frontend http://localhost:5173
```

Add your provider API keys (one or several per provider) on the Settings page after signing in (for example a free OpenRouter key from
https://openrouter.ai/keys). The evidence clerk needs an OpenRouter or Gemini key.

## Deploying to Vercel

One Vercel project, one deployment, using [Vercel Services](https://vercel.com/docs/services): the root
`vercel.json` defines a `frontend` service (served at `/`) and a `backend` service (Express, served at `/api`).
Import the repo and choose the **Services** preset.

Vercel does not read `.env` files. Add these in the project's Environment Variables settings:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_KEY_ENCRYPTION_SECRET`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Model API keys are not env vars: each user adds theirs on the Settings page.
Leave `VITE_API_BASE_URL` empty (same origin) and `CORS_ORIGIN` unset.

Then add the deployed URL to Supabase → Authentication → URL Configuration (Site URL and Redirect URLs).
Sanity check after deploying: `https://<your-domain>/api/health` should return `{"ok":true}`.

Judging is asynchronous: each step returns 202 and runs via `waitUntil` (`maxDuration` is 300s for the backend
service in `vercel.json`; your plan must allow that). Each step is its own request with its own time budget, and
step 1 has an internal 120s deadline. The results page polls while anything is running. Uploads are capped at 4MB (Vercel's request body limit).

## Supabase setup after deploying

Do these once you have the deployed URL (referred to as `https://<your-domain>`):

1. **Apply the database migration** to the hosted project (skip if already done):
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   In Supabase → Table Editor, confirm `sessions`, `persona_verdicts`, `chairman_verdicts`, `evidence_requests`, `evidence_documents` and
   `user_model_settings` exist with RLS enabled.

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
   link, submit a session, press through steps 2 to 4, and confirm rows appear in `sessions`, `evidence_requests`,
   `evidence_documents`, `persona_verdicts` and `chairman_verdicts`.
   Signing in as a second user should show none of the first user's sessions.

## Project structure

```
backend/    Express API: auth middleware, session CRUD, file parsing, council orchestration
            (services/council.ts: requests, clerk, verdicts, peer review, chairman;
            services/evidencePipeline.ts + fetchDocument.ts: find, fetch, extract)
frontend/   Vue app: auth, new session form, results view, session history
supabase/   SQL migrations + local dev config
```
