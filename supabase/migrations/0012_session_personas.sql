-- Which council personas take part in a session. NULL means all of them (every session created before this).
alter table sessions add column if not exists persona_keys text[];
