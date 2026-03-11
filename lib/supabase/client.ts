import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client using the anon key.
 * Safe to use in client components. Subject to Row Level Security.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
