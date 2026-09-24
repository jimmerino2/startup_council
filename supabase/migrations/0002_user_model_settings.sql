-- Per-user model configuration: which provider/model each council role uses,
-- plus encrypted API keys. Ciphertext only — decryption happens server-side
-- (see backend/src/services/crypto.ts); RLS keeps rows scoped to their owner
-- as defense in depth on top of that.

create table if not exists user_model_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  models jsonb not null default '{}'::jsonb,
  openrouter_api_key_encrypted text,
  gemini_api_key_encrypted text,
  updated_at timestamptz not null default now()
);

alter table user_model_settings enable row level security;

create policy "user_model_settings_owner_select" on user_model_settings for select using (auth.uid() = user_id);
create policy "user_model_settings_owner_insert" on user_model_settings for insert with check (auth.uid() = user_id);
create policy "user_model_settings_owner_update" on user_model_settings for update using (auth.uid() = user_id);
