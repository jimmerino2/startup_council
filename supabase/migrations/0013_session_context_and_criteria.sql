-- Structured session context, stored as real columns so sessions can be grouped and linked
-- (the graph view, filters) without parsing text. All optional; older sessions leave them empty.
alter table sessions
  add column if not exists event_type text,
  add column if not exists stage text,
  add column if not exists links text[] not null default '{}',
  -- [{ "name": "...", "description": "...", "weight": 25 }]; null when the rubric was pasted as text.
  add column if not exists criteria jsonb;
