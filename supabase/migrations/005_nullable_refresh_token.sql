-- Migration: 005_nullable_refresh_token
-- GitHub OAuth Apps do not issue refresh tokens; make these columns optional.

alter table user_github_tokens
  alter column refresh_token drop not null,
  alter column refresh_token_expires_at drop not null,
  alter column access_token_expires_at drop not null;
