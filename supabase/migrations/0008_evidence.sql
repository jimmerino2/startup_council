-- Evidence stage: each persona files up to N evidence requests (the limit is a per-user
-- setting), and a web-search-capable "clerk" model retrieves the material. Personas then
-- argue from that evidence. One row per request.

alter table user_model_settings
  add column max_evidence_per_persona int not null default 2 check (max_evidence_per_persona >= 0 and max_evidence_per_persona <= 5);

alter table sessions
  add column evidence_status text not null default 'pending' check (evidence_status in ('pending', 'running', 'complete', 'failed', 'skipped')),
  add column evidence_error text;

create table if not exists evidence_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  persona_key text not null,
  description text not null,
  reason text,
  -- not_found: the clerk searched but returned no citable sources (nothing is invented).
  status text not null default 'pending' check (status in ('pending', 'running', 'complete', 'not_found', 'failed')),
  summary text,
  -- [{ "url": "...", "title": "..." }] — taken from the search provider's citations, never from model text.
  sources jsonb not null default '[]'::jsonb,
  model_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists evidence_requests_session_id_idx on evidence_requests (session_id);
create index if not exists evidence_requests_user_id_idx on evidence_requests (user_id);

alter table evidence_requests enable row level security;

create policy "evidence_requests_owner_select" on evidence_requests for select using (auth.uid() = user_id);
create policy "evidence_requests_owner_insert" on evidence_requests for insert with check (auth.uid() = user_id);
create policy "evidence_requests_owner_update" on evidence_requests for update using (auth.uid() = user_id);
create policy "evidence_requests_owner_delete" on evidence_requests for delete using (auth.uid() = user_id);
