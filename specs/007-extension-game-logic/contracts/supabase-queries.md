# Contract: Supabase Query Interface

**Feature**: 007-extension-game-logic
**Type**: External data contract (extension → Supabase)

---

## Overview

The extension reads from Supabase using the existing browser client (`@supabase/supabase-js`) with the authenticated session from `chrome.storage.local`. All queries are read-only. RLS ensures users can only see their own commit events.

---

## Query: Get New Commits Since Last Tick

**Used by**: `game.ts` on each tick invocation

**Table**: `commit_events` (migration 004)

**Query**:
```typescript
const { data, error } = await supabase
  .from('commit_events')
  .select('commit_sha, diff_size, occurred_at, user_id')
  .eq('user_id', session.userId)
  .gt('occurred_at', new Date(lastCommitAt ?? 0).toISOString())
  .order('occurred_at', { ascending: true })
  .limit(5);
```

**Expected response shape**:
```typescript
type CommitRecord = {
  commit_sha: string;
  diff_size: number;
  occurred_at: string;  // ISO 8601
  user_id: string;
};
```

**Error handling**:
- On error (network, auth): log to console, skip commit processing for this tick. Do not crash or clear game state.
- On empty result: no new commits; proceed with normal tick drain/recovery only.
- On `data.length > 0`: process each commit in chronological order, accumulate debt.

---

## Authentication

Uses `getValidSession()` from `extension/src/auth.ts` before querying. If session is null or expired and cannot be refreshed, skip the Supabase query entirely — handle as "no new commits."

---

## RLS Policy (existing, no changes needed)

```sql
-- Users can only view their own commit events (from migration 004)
CREATE POLICY "Users can view own commit events"
  ON commit_events FOR SELECT
  USING (auth.uid() = user_id);
```
