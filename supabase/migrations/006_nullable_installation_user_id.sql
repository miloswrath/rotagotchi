-- Migration: 006_nullable_installation_user_id
-- Webhooks arrive before a user signs in, so user_id cannot be set at insert time.
-- The OAuth callback links the installation to the user after sign-in.

alter table webhook_installations
  alter column user_id drop not null;
