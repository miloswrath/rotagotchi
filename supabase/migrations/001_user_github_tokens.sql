-- Migration: 001_user_github_tokens
-- GitHub App user-to-server tokens for each authenticated user.
-- Supabase does not persist provider_token natively, so we store it here.

create table if not exists user_github_tokens (
  user_id               uuid        primary key references auth.users(id) on delete cascade,
  access_token          text        not null,
  refresh_token         text        not null,
  access_token_expires_at  timestamptz not null,
  refresh_token_expires_at timestamptz not null,
  updated_at            timestamptz not null default now()
);

-- RLS
alter table user_github_tokens enable row level security;

create policy "Users can manage their own GitHub tokens"
  on user_github_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
