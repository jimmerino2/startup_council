-- Peer review as data instead of a paragraph: one row per (reviewer, reviewed) pair, holding the rank
-- the reviewer gave and a short critique of that one verdict. Still written from a single model call
-- per reviewer, so the cost is unchanged.
--
-- persona_verdicts.review_status / review_error keep tracking the reviewer's progress. The old
-- review_critique and review_ranking columns are dropped by 0015 once their rankings are copied here.

create table if not exists peer_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reviewer_key text not null,
  reviewed_key text not null,
  -- 1 = best among the verdicts this reviewer saw.
  rank int not null check (rank >= 1),
  -- Null for reviews migrated from before this table existed (they only had a ranking).
  critique text,
  created_at timestamptz not null default now(),
  unique (session_id, reviewer_key, reviewed_key)
);

create index if not exists peer_reviews_session_id_idx on peer_reviews (session_id);
create index if not exists peer_reviews_user_id_idx on peer_reviews (user_id);

alter table peer_reviews enable row level security;

create policy "peer_reviews_owner_select" on peer_reviews for select using (auth.uid() = user_id);
create policy "peer_reviews_owner_insert" on peer_reviews for insert with check (auth.uid() = user_id);
create policy "peer_reviews_owner_delete" on peer_reviews for delete using (auth.uid() = user_id);

-- Carry existing rankings over so older sessions keep working (and show up in the graph).
insert into peer_reviews (session_id, user_id, reviewer_key, reviewed_key, rank)
select pv.session_id, pv.user_id, pv.persona_key, r.reviewed_key, r.ord::int
from persona_verdicts pv,
  lateral jsonb_array_elements_text(pv.review_ranking) with ordinality as r(reviewed_key, ord)
where pv.review_status = 'complete'
on conflict (session_id, reviewer_key, reviewed_key) do nothing;
