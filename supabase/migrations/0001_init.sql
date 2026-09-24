-- Startup Council: sessions, persona verdicts, and chairman verdicts.
-- Every table carries user_id directly so RLS policies stay simple (no joins).

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  problem_statement text not null,
  judging_criteria text not null,
  pitch_text text not null,
  source_files jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'judging', 'complete', 'error')),
  created_at timestamptz not null default now()
);

create table if not exists persona_verdicts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  persona_key text not null,
  model_id text not null,
  verdict_text text not null,
  score numeric not null check (score >= 0 and score <= 10),
  strengths jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists chairman_verdicts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  model_id text not null,
  final_verdict_text text not null,
  overall_score numeric not null check (overall_score >= 0 and overall_score <= 10),
  recommendation text not null check (recommendation in ('fund', 'iterate', 'pass')),
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists persona_verdicts_session_id_idx on persona_verdicts (session_id);
create index if not exists persona_verdicts_user_id_idx on persona_verdicts (user_id);
create index if not exists chairman_verdicts_session_id_idx on chairman_verdicts (session_id);
create index if not exists chairman_verdicts_user_id_idx on chairman_verdicts (user_id);

alter table sessions enable row level security;
alter table persona_verdicts enable row level security;
alter table chairman_verdicts enable row level security;

create policy "sessions_owner_select" on sessions for select using (auth.uid() = user_id);
create policy "sessions_owner_insert" on sessions for insert with check (auth.uid() = user_id);
create policy "sessions_owner_update" on sessions for update using (auth.uid() = user_id);
create policy "sessions_owner_delete" on sessions for delete using (auth.uid() = user_id);

create policy "persona_verdicts_owner_select" on persona_verdicts for select using (auth.uid() = user_id);
create policy "persona_verdicts_owner_insert" on persona_verdicts for insert with check (auth.uid() = user_id);

create policy "chairman_verdicts_owner_select" on chairman_verdicts for select using (auth.uid() = user_id);
create policy "chairman_verdicts_owner_insert" on chairman_verdicts for insert with check (auth.uid() = user_id);
