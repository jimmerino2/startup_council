-- Stage 2 (anonymous peer review): each persona reviews the other personas' verdicts
-- with names hidden, and ranks them. Stored on the reviewer's own persona_verdicts row.
-- review_ranking is the reviewer's ranking of the OTHER personas' keys, best first.

alter table persona_verdicts
  add column review_status text not null default 'pending' check (review_status in ('pending', 'running', 'complete', 'failed')),
  add column review_critique text,
  add column review_ranking jsonb not null default '[]'::jsonb,
  add column review_error text;
