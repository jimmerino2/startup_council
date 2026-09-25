-- Several API keys per provider. Calls alternate between the usable keys, and a key that hits a rate
-- limit or quota is parked (status 'limited' + limited_until) so the others take over until it recovers.
-- Ciphertext only, like user_model_settings: decryption happens server-side.

create table if not exists provider_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('openrouter', 'gemini', 'mistral', 'groq', 'gonka')),
  name text not null,
  key_encrypted text not null,
  -- Last 4 characters of the key so the user can tell keys apart without the secret ever leaving the server.
  key_hint text,
  -- limited: rate-limited or out of quota until limited_until. disabled: turned off by the user, or rejected as invalid.
  status text not null default 'active' check (status in ('active', 'limited', 'disabled')),
  limited_until timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists provider_api_keys_user_provider_idx on provider_api_keys (user_id, provider);

alter table provider_api_keys enable row level security;

create policy "provider_api_keys_owner_select" on provider_api_keys for select using (auth.uid() = user_id);
create policy "provider_api_keys_owner_insert" on provider_api_keys for insert with check (auth.uid() = user_id);
create policy "provider_api_keys_owner_update" on provider_api_keys for update using (auth.uid() = user_id);
create policy "provider_api_keys_owner_delete" on provider_api_keys for delete using (auth.uid() = user_id);

-- Carry over the single key each user already saved (same ciphertext, so no decryption is needed).
insert into provider_api_keys (user_id, provider, name, key_encrypted)
select user_id, 'openrouter', 'Default', openrouter_api_key_encrypted from user_model_settings where openrouter_api_key_encrypted is not null
union all
select user_id, 'gemini', 'Default', gemini_api_key_encrypted from user_model_settings where gemini_api_key_encrypted is not null
union all
select user_id, 'mistral', 'Default', mistral_api_key_encrypted from user_model_settings where mistral_api_key_encrypted is not null
union all
select user_id, 'groq', 'Default', groq_api_key_encrypted from user_model_settings where groq_api_key_encrypted is not null
union all
select user_id, 'gonka', 'Default', gonka_api_key_encrypted from user_model_settings where gonka_api_key_encrypted is not null;
