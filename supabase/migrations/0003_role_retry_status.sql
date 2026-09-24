-- Per-role retry support: persona_verdicts now gets one row per persona as soon
-- as judging starts (status starts 'pending'), updated in place as each persona
-- runs/completes/fails/is retried, rather than only appearing once it succeeds.
-- The chairman is tracked on sessions directly since there's only ever one.

alter table persona_verdicts
  alter column verdict_text drop not null,
  alter column score drop not null,
  add column status text not null default 'complete' check (status in ('pending', 'running', 'complete', 'failed')),
  add column error_message text;

-- Retry re-runs one persona and updates its existing row rather than inserting
-- a duplicate; upserting the initial pending rows relies on this too.
alter table persona_verdicts
  add constraint persona_verdicts_session_persona_unique unique (session_id, persona_key);

-- Needed now that rows are updated in place (previously insert-only).
create policy "persona_verdicts_owner_update" on persona_verdicts for update using (auth.uid() = user_id);

alter table sessions
  add column chairman_status text not null default 'pending' check (chairman_status in ('pending', 'running', 'complete', 'failed')),
  add column chairman_error text;

-- The chairman is re-run in place too (retry), so upsert by session.
alter table chairman_verdicts
  add constraint chairman_verdicts_session_unique unique (session_id);

create policy "chairman_verdicts_owner_update" on chairman_verdicts for update using (auth.uid() = user_id);
