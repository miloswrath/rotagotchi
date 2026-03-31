import { createHmac, createSign, timingSafeEqual } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GitHub App authentication helpers
// ---------------------------------------------------------------------------

function createAppJWT(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 600, iss: process.env.GITHUB_APP_ID })).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  return `${signingInput}.${sign.sign(privateKey, "base64url")}`;
}

async function getInstallationToken(installationId: number): Promise<string> {
  const resp = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${createAppJWT()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!resp.ok) throw new Error(`Failed to get installation token: ${resp.status}`);
  const data = (await resp.json()) as { token: string };
  return data.token;
}

async function fetchCommitStats(
  repoFullName: string,
  sha: string,
  token: string
): Promise<{ additions: number; deletions: number }> {
  const resp = await fetch(`https://api.github.com/repos/${repoFullName}/commits/${sha}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!resp.ok) return { additions: 0, deletions: 0 };
  const data = (await resp.json()) as { stats?: { additions: number; deletions: number } };
  return { additions: data.stats?.additions ?? 0, deletions: data.stats?.deletions ?? 0 };
}

/**
 * Verifies a GitHub webhook signature using HMAC-SHA256.
 *
 * IMPORTANT: rawBody must be the raw, unparsed request body string.
 * Any JSON parsing before calling this function may alter whitespace
 * and invalidate the signature.
 *
 * @param rawBody   - Raw request body as a string (from request.text())
 * @param signature - Value of the X-Hub-Signature-256 header (e.g. "sha256=abc123")
 * @param secret    - GITHUB_WEBHOOK_SECRET shared between GitHub and this server
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const digest = `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;

  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    // timingSafeEqual throws if buffers have different lengths
    return false;
  }
}

// ---------------------------------------------------------------------------
// Payload type helpers
// ---------------------------------------------------------------------------

interface PushPayload {
  installation?: { id: number };
  repository: { full_name: string };
  ref: string;
  head_commit?: { id: string; timestamp: string };
  commits?: Array<{
    id: string;
  }>;
  // GitHub also provides top-level stats in some webhook formats
  // We aggregate per-commit when available, fall back to 0
}

interface PullRequestPayload {
  installation?: { id: number };
  action: string;
  repository: { full_name: string };
  pull_request: {
    additions: number;
    deletions: number;
    head: { sha: string };
    base: { ref: string };
    updated_at: string;
  };
}

interface InstallationPayload {
  installation: {
    id: number;
    account: { login: string; type: string };
    repository_selection: string;
  };
  action: string;
  sender: { id: number };
}

// ---------------------------------------------------------------------------
// Event processor
// ---------------------------------------------------------------------------

/**
 * Extracts commit metrics from a validated webhook event and inserts a row
 * into commit_events. Marks the source webhook_event as processed.
 *
 * Constitutional metric: diff_size = lines_added + lines_deleted (Principle II)
 */
export async function processWebhookEvent(
  deliveryId: string,
  eventType: string,
  payload: unknown
): Promise<void> {
  const supabase = createServiceRoleClient();

  if (eventType === "push") {
    const push = payload as PushPayload;
    const installationId = push.installation?.id;

    if (!installationId) return;

    // Resolve user_id from installation
    const { data: install } = await supabase
      .from("webhook_installations")
      .select("user_id")
      .eq("installation_id", installationId)
      .single();

    if (!install?.user_id) return;

    // Fetch diff stats from GitHub API (not included in push webhook payload)
    const token = await getInstallationToken(installationId);
    let linesAdded = 0;
    let linesDeleted = 0;
    for (const commit of push.commits ?? []) {
      if (!commit.id) continue;
      const stats = await fetchCommitStats(push.repository.full_name, commit.id, token);
      linesAdded += stats.additions;
      linesDeleted += stats.deletions;
    }

    const diffSize = linesAdded + linesDeleted;
    const occurredAt =
      push.head_commit?.timestamp ?? new Date().toISOString();

    const { error: insertError } = await supabase
      .from("commit_events")
      .insert({
        delivery_id: deliveryId,
        user_id: install.user_id,
        repo_full_name: push.repository.full_name,
        commit_sha: push.head_commit?.id ?? null,
        branch: push.ref.replace("refs/heads/", ""),
        diff_size: diffSize,
        lines_added: linesAdded,
        lines_deleted: linesDeleted,
        event_type: "push",
        occurred_at: occurredAt,
      });

    if (insertError) {
      throw new Error(`Failed to insert commit_event: ${insertError.message}`);
    }
  } else if (eventType === "pull_request") {
    const pr = payload as PullRequestPayload;
    const installationId = pr.installation?.id;

    if (!installationId) return;

    const { data: install } = await supabase
      .from("webhook_installations")
      .select("user_id")
      .eq("installation_id", installationId)
      .single();

    if (!install) return;

    const linesAdded = pr.pull_request.additions;
    const linesDeleted = pr.pull_request.deletions;
    const diffSize = linesAdded + linesDeleted;

    const { error: insertError } = await supabase
      .from("commit_events")
      .insert({
        delivery_id: deliveryId,
        user_id: install.user_id,
        repo_full_name: pr.repository.full_name,
        commit_sha: pr.pull_request.head.sha,
        branch: pr.pull_request.base.ref,
        diff_size: diffSize,
        lines_added: linesAdded,
        lines_deleted: linesDeleted,
        event_type: "pull_request",
        occurred_at: pr.pull_request.updated_at,
      });

    if (insertError) {
      throw new Error(`Failed to insert commit_event: ${insertError.message}`);
    }
  }

  // Mark source event as processed
  await supabase
    .from("webhook_events")
    .update({ processed: true })
    .eq("delivery_id", deliveryId);
}

// ---------------------------------------------------------------------------
// Installation event handler
// ---------------------------------------------------------------------------

/**
 * Handles GitHub App installation lifecycle events.
 * Keeps webhook_installations table in sync with actual GitHub state.
 */
export async function handleInstallationEvent(
  payload: InstallationPayload
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { installation, action } = payload;

  if (action === "created") {
    // Resolve user_id from sender (the user who installed the app)
    // Note: sender.id is the GitHub user ID — we look up by matching the
    // installation account login against auth.users identities
    await supabase.from("webhook_installations").upsert(
      {
        installation_id: installation.id,
        account_login: installation.account.login,
        account_type: installation.account.type,
        access_all_repos: installation.repository_selection === "all",
        suspended_at: null,
      },
      { onConflict: "installation_id", ignoreDuplicates: false }
    );

    // Immediately link to any existing Supabase user whose GitHub login matches.
    // This handles the extension OAuth flow where the user authenticates before
    // installing the app, so the install-status linking pass already ran and found
    // no row to update.
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const match = users.find(
      (u) =>
        (u.user_metadata?.user_name as string | undefined) ===
        installation.account.login
    );
    if (match) {
      await supabase
        .from("webhook_installations")
        .update({ user_id: match.id })
        .eq("installation_id", installation.id);
    }
  } else if (action === "deleted") {
    await supabase
      .from("webhook_installations")
      .delete()
      .eq("installation_id", installation.id);
  } else if (action === "suspend") {
    await supabase
      .from("webhook_installations")
      .update({ suspended_at: new Date().toISOString() })
      .eq("installation_id", installation.id);
  } else if (action === "unsuspend") {
    await supabase
      .from("webhook_installations")
      .update({ suspended_at: null })
      .eq("installation_id", installation.id);
  }
}
