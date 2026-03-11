-- Migration: 003_webhook_events
-- Raw event log. Append-only. Primary key on delivery_id enforces idempotency.
-- GitHub retries failed deliveries using the same X-GitHub-Delivery UUID.

create table if not exists webhook_events (
  delivery_id     uuid        primary key,  -- X-GitHub-Delivery header value
  installation_id bigint      not null references webhook_installations(installation_id) on delete cascade,
  event_type      text        not null,     -- X-GitHub-Event header value
  action          text,                     -- payload.action where applicable
  received_at     timestamptz not null default now(),
  payload         jsonb       not null,
  processed       boolean     not null default false
);

create index if not exists webhook_events_installation_id_idx
  on webhook_events (installation_id);

create index if not exists webhook_events_processed_idx
  on webhook_events (processed) where processed = false;

-- RLS
alter table webhook_events enable row level security;

-- Service role inserts (webhook receiver uses service role key)
-- Users can read their own events via installation ownership
create policy "Users can view their own webhook events"
  on webhook_events
  for select
  using (
    installation_id in (
      select installation_id from webhook_installations
      where user_id = auth.uid()
    )
  );
