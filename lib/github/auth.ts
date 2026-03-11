import { createServiceRoleClient } from "@/lib/supabase/server";

const GITHUB_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";

/**
 * Stores (or replaces) the GitHub App user-to-server tokens for a user.
 * Called immediately after the OAuth callback — Supabase does not persist
 * provider_token natively.
 */
export async function storeGitHubTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  accessTokenExpiresAt: Date,
  refreshTokenExpiresAt: Date
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("user_github_tokens").upsert(
    {
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      access_token_expires_at: accessTokenExpiresAt.toISOString(),
      refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Failed to store GitHub tokens: ${error.message}`);
  }
}

/**
 * Refreshes the GitHub access token if it expires within the next 60 minutes.
 * Updates the stored tokens on success.
 */
export async function refreshGitHubTokenIfNeeded(
  userId: string
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("user_github_tokens")
    .select(
      "refresh_token, access_token_expires_at, refresh_token_expires_at"
    )
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error(`No GitHub tokens found for user ${userId}`);
  }

  const expiresAt = new Date(data.access_token_expires_at);
  const sixtyMinutesFromNow = new Date(Date.now() + 60 * 60 * 1000);

  if (expiresAt > sixtyMinutesFromNow) {
    return; // Token is still valid for more than 60 minutes
  }

  const refreshTokenExpiry = new Date(data.refresh_token_expires_at);
  if (refreshTokenExpiry < new Date()) {
    throw new Error(
      `GitHub refresh token expired for user ${userId} — re-authorization required`
    );
  }

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    client_secret: process.env.GITHUB_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: data.refresh_token,
  });

  const response = await fetch(GITHUB_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub token refresh failed: ${response.status} ${response.statusText}`
    );
  }

  const refreshed = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_token_expires_in: number;
    error?: string;
  };

  if (refreshed.error) {
    throw new Error(`GitHub token refresh error: ${refreshed.error}`);
  }

  const newAccessExpiry = new Date(
    Date.now() + refreshed.expires_in * 1000
  );
  const newRefreshExpiry = new Date(
    Date.now() + refreshed.refresh_token_expires_in * 1000
  );

  await storeGitHubTokens(
    userId,
    refreshed.access_token,
    refreshed.refresh_token,
    newAccessExpiry,
    newRefreshExpiry
  );
}

/**
 * Returns a valid GitHub access token for the user, refreshing it first if
 * it is within 60 minutes of expiry.
 */
export async function getValidGitHubToken(userId: string): Promise<string> {
  await refreshGitHubTokenIfNeeded(userId);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("user_github_tokens")
    .select("access_token")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error(`No GitHub access token found for user ${userId}`);
  }

  return data.access_token;
}

/**
 * Deletes the stored GitHub tokens for a user (called on sign-out).
 */
export async function deleteGitHubTokens(userId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("user_github_tokens")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete GitHub tokens: ${error.message}`);
  }
}
