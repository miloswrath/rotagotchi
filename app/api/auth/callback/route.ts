import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { storeGitHubTokens } from "@/lib/github/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

const GITHUB_APP_INSTALL_URL = `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/?auth=error&reason=missing_code", request.url)
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("[auth/callback] Code exchange failed:", error?.message);
    return NextResponse.redirect(
      new URL("/?auth=error&reason=exchange_failed", request.url)
    );
  }

  const { session } = data;
  const userId = session.user.id;
  const providerToken = session.provider_token;
  const providerRefreshToken = session.provider_refresh_token;

  if (!providerToken) {
    console.error("[auth/callback] Missing provider token for user", userId);
    return NextResponse.redirect(
      new URL("/?auth=error&reason=missing_provider_tokens", request.url)
    );
  }

  // GitHub App user-to-server tokens expire in 8 hours; refresh tokens in 6 months.
  // Supabase does not surface the expiry, so we derive it from documented defaults.
  const now = Date.now();
  const accessTokenExpiresAt = new Date(now + 8 * 60 * 60 * 1000);
  const refreshTokenExpiresAt = new Date(now + 180 * 24 * 60 * 60 * 1000);

  try {
    await storeGitHubTokens(
      userId,
      providerToken,
      providerRefreshToken ?? null,
      accessTokenExpiresAt,
      refreshTokenExpiresAt
    );
  } catch (err) {
    console.error("[auth/callback] Failed to store GitHub tokens:", err);
    return NextResponse.redirect(
      new URL("/?auth=error&reason=token_storage_failed", request.url)
    );
  }

  const serviceClient = createServiceRoleClient();
  const githubLogin = session.user.user_metadata?.user_name as string | undefined;

  // Link any unlinked installation matching this GitHub account to the user
  if (githubLogin) {
    await serviceClient
      .from("webhook_installations")
      .update({ user_id: userId })
      .eq("account_login", githubLogin)
      .is("user_id", null);
  }

  // Check if the user has a GitHub App installation
  const { data: installation } = await serviceClient
    .from("webhook_installations")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (!installation) {
    return NextResponse.redirect(GITHUB_APP_INSTALL_URL);
  }

  return NextResponse.redirect(new URL("/?auth=success", request.url));
}
