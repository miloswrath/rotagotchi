"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import IdlePet from "@/app/components/IdlePet";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function Home() {
  const searchParams = useSearchParams();
  const authStatus = searchParams.get("auth");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  function signIn() {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        scopes: "read:user user:email",
      },
    });
  }

  function signOut() {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.signOut().then(() => {
      window.location.href = "/";
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-8 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Rotagotchi
      </h1>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <IdlePet />
      </div>

      {!loading && (
        <div className="flex flex-col items-center gap-3">
          {user ? (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Signed in as <strong>{user.email}</strong>
              </p>
              <button
                onClick={signOut}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              {authStatus === "error" && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Sign-in failed. Please try again.
                </p>
              )}
              <button
                onClick={signIn}
                className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Sign in with GitHub
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
