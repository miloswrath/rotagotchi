-- Migration: 004_commit_events
-- Normalized push/PR event records consumed by downstream tamagotchi logic.
--
-- CONSTITUTIONAL METRIC (Principle II, Operational Policy):
--   diff_size = lines_added + lines_deleted
--   This definition is fixed by the Rotagotchi Constitution v1.0.1.
--   Any change requires a constitutional amendment.

create table if not exists commit_events (
  id              uuid        primary key default gen_random_uuid(),
  delivery_id     uuid        not null unique references webhook_events(delivery_id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  repo_full_name  text        not null,
  commit_sha      text,
  branch          text,
  -- Constitutional commit size metric: lines_added + lines_deleted
  diff_size       integer     not null check (diff_size >= 0),
  lines_added     integer     not null check (lines_added >= 0),
  lines_deleted   integer     not null check (lines_deleted >= 0),
  event_type      text        not null check (event_type in ('push', 'pull_request')),
  occurred_at     timestamptz not null,
  created_at      timestamptz not null default now()
);

create index if not exists commit_events_user_id_idx
  on commit_events (user_id);

create index if not exists commit_events_occurred_at_idx
  on commit_events (user_id, occurred_at desc);

-- RLS
alter table commit_events enable row level security;

create policy "Users can view their own commit events"
  on commit_events
  for select
  using (user_id = auth.uid());

-- Service role handles inserts (event processor uses service role key)
