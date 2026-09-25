-- Evidence pipeline v2: the clerk now finds sources, the server downloads them, and the extracted,
-- role-relevant facts are stored next to the raw text. Every request ends in a stored outcome.

-- 'partial' = sources were found but couldn't be downloaded/extracted, so only the search summary is kept.
alter table evidence_requests drop constraint if exists evidence_requests_status_check;
alter table evidence_requests
  add constraint evidence_requests_status_check check (status in ('pending', 'running', 'complete', 'partial', 'not_found', 'failed')),
  -- 'request_list' rows record that a persona failed to decide what to ask for (retryable).
  add column kind text not null default 'document' check (kind in ('document', 'request_list')),
  add column note text;

create table if not exists evidence_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references evidence_requests (id) on delete cascade,
  session_id uuid not null references sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  title text,
  content_type text,
  bytes int,
  -- Extracted plain text of the downloaded page/PDF/DOCX (binary files themselves are not stored).
  raw_text text,
  fetch_status text not null check (fetch_status in ('fetched', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists evidence_documents_request_id_idx on evidence_documents (request_id);
create index if not exists evidence_documents_session_id_idx on evidence_documents (session_id);

alter table evidence_documents enable row level security;

create policy "evidence_documents_owner_select" on evidence_documents for select using (auth.uid() = user_id);
create policy "evidence_documents_owner_insert" on evidence_documents for insert with check (auth.uid() = user_id);
create policy "evidence_documents_owner_delete" on evidence_documents for delete using (auth.uid() = user_id);

-- Whether peer reviewers see everyone's evidence ('all') or only the evidence they requested themselves ('own').
alter table user_model_settings
  add column peer_review_evidence text not null default 'all' check (peer_review_evidence in ('all', 'own'));
