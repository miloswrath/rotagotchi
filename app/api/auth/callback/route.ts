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

  if (!providerToken || !providerRefreshToken) {
    console.error("[auth/callback] Missing provider tokens for user", userId);
    return NextResponse.redirect(
      new URL("/?auth=error&reason=missing_provider_tokens", request.url)
    );
  }

  // GitHub App user-to-server tokens expire in 8 hours; refresh tokens in 6 months
  const accessTokenExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const refreshTokenExpiresAt = new Date(
    Date.now() + 6 * 30 * 24 * 60 * 60 * 1000
  );

  try {
    await storeGitHubTokens(
      userId,
      providerToken,
      providerRefreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt
    );
  } catch (err) {
    console.error("[auth/callback] Failed to store GitHub tokens:", err);
    return NextResponse.redirect(
      new URL("/?auth=error&reason=token_storage_failed", request.url)
    );
  }

  // Check if the user has a GitHub App installation
  const serviceClient = createServiceRoleClient();
  const { data: installation } = await serviceClient
    .from("webhook_installations")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (!installation) {
    // Redirect to GitHub App installation page
    return NextResponse.redirect(GITHUB_APP_INSTALL_URL);
  }

  return NextResponse.redirect(new URL("/?auth=success", request.url));
}
