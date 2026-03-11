import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { deleteGitHubTokens } from "@/lib/github/auth";

export async function POST(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await deleteGitHubTokens(user.id);
    } catch (err) {
      console.error("[auth/signout] Failed to delete GitHub tokens:", err);
      // Non-fatal — proceed with Supabase sign-out regardless
    }
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(
    new URL("/?auth=signed_out", request.url)
  );
}
