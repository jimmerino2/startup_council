-- Fewer calls per idea: identical/near-identical evidence requests from different personas are merged
-- into one row (one search, one download, one extraction) that lists every persona who asked for it.

alter table evidence_requests add column requested_by text[] not null default '{}';
update evidence_requests set requested_by = array[persona_key] where requested_by = '{}';

-- Extraction (the second clerk call per request) can be switched off to save calls.
alter table user_model_settings add column extract_evidence boolean not null default true;

-- One evidence request per persona is the new default (each is a search + a download + an extraction).
alter table user_model_settings alter column max_evidence_per_persona set default 1;
