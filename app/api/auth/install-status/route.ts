import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { storeGitHubTokens } from "@/lib/github/auth";

const GITHUB_APP_INSTALL_URL = `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceRoleClient();

  // Validate the Supabase JWT and get the user.
  const {
    data: { user },
    error,
  } = await serviceClient.auth.getUser(accessToken);

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Store GitHub provider tokens if the extension passed them.
  // The extension receives these from exchangeCodeForSession but the web
  // callback route is never hit in the extension OAuth flow.
  const githubToken = request.headers.get("x-github-token");
  const githubRefreshToken = request.headers.get("x-github-refresh-token");
  if (githubToken) {
    try {
      const now = Date.now();
      await storeGitHubTokens(
        user.id,
        githubToken,
        githubRefreshToken ?? null,
        new Date(now + 8 * 60 * 60 * 1000),   // 8-hour access token
        githubRefreshToken ? new Date(now + 180 * 24 * 60 * 60 * 1000) : null
      );
    } catch {
      // Non-fatal — token storage failing should not block install-status response.
    }
  }

  const githubLogin = user.user_metadata?.user_name as string | undefined;

  // Link any unlinked installation matching this GitHub account to the user.
  if (githubLogin) {
    await serviceClient
      .from("webhook_installations")
      .update({ user_id: user.id })
      .eq("account_login", githubLogin)
      .is("user_id", null);
  }

  const { data: installation } = await serviceClient
    .from("webhook_installations")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!installation) {
    return NextResponse.json({
      needsInstall: true,
      installUrl: GITHUB_APP_INSTALL_URL,
    });
  }

  return NextResponse.json({ needsInstall: false });
}
