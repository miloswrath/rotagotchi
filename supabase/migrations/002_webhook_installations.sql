-- Migration: 002_webhook_installations
-- Tracks GitHub App installations per user.
-- Required to generate installation access tokens for server-side GitHub API calls.

create table if not exists webhook_installations (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  installation_id bigint      not null unique,
  account_login   text        not null,
  account_type    text        not null check (account_type in ('User', 'Organization')),
  access_all_repos boolean    not null default false,
  installed_at    timestamptz not null default now(),
  suspended_at    timestamptz
);

create index if not exists webhook_installations_user_id_idx
  on webhook_installations (user_id);

-- RLS
alter table webhook_installations enable row level security;

create policy "Users can view their own installations"
  on webhook_installations
  for select
  using (user_id = auth.uid());

-- Service role handles inserts/updates/deletes via webhook events
