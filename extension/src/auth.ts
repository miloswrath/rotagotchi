import { createClient, Session } from '@supabase/supabase-js';

// esbuild replaces these at build time via `define` in scripts/build-extension.js.
declare const process: {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  };
};

// ─── Types (T003) ─────────────────────────────────────────────────────────────

export interface StoredAuthSession {
  accessToken: string;
  refreshToken: string;
  /** Unix timestamp (seconds) — when accessToken expires */
  expiresAt: number;
  userId: string;
  githubLogin: string;
  githubEmail: string | null;
}

export type PopupScreen = 'intro' | 'login' | 'main';

// ─── Supabase client ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Extension manages its own session persistence (chrome.storage.local).
// Supabase's internal session storage is used only for the PKCE code verifier
// during the OAuth dance — both signInWithOAuth and exchangeCodeForSession
// happen in the same popup context so localStorage is sufficient.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const SESSION_KEY = 'authSession';
const REFRESH_THRESHOLD_SECONDS = 5 * 60; // refresh if expiry is within 5 min

// ─── T004: getSession ─────────────────────────────────────────────────────────

export async function getSession(): Promise<StoredAuthSession | null> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  const session = result[SESSION_KEY] as StoredAuthSession | undefined;
  return session ?? null;
}

// ─── T005: onSessionChanged ───────────────────────────────────────────────────

export function onSessionChanged(
  callback: (session: StoredAuthSession | null) => void
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== 'local' || !(SESSION_KEY in changes)) return;
    const newValue = changes[SESSION_KEY].newValue as StoredAuthSession | undefined;
    callback(newValue ?? null);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// ─── T006: PKCE helpers (used internally by launchOAuthFlow) ──────────────────

// Note: Supabase JS client handles PKCE code verifier storage and retrieval
// internally via its auth storage (localStorage). These helpers are not needed
// as standalone functions; Supabase manages them during signInWithOAuth /
// exchangeCodeForSession. This section is retained as documentation.

// ─── T007: launchOAuthFlow ────────────────────────────────────────────────────

export async function launchOAuthFlow(): Promise<StoredAuthSession> {
  const redirectUrl = chrome.identity.getRedirectURL();

  // Supabase generates the OAuth URL including the PKCE code challenge.
  // skipBrowserRedirect prevents Supabase from navigating the tab; we drive
  // the flow ourselves via chrome.identity.launchWebAuthFlow.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
      scopes: 'read:user user:email',
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? 'Failed to generate OAuth URL');
  }

  // Open the Chrome identity auth window.
  const responseUrl: string = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: data.url, interactive: true },
      (url) => {
        if (chrome.runtime.lastError || !url) {
          reject(new Error(chrome.runtime.lastError?.message ?? 'OAuth flow cancelled'));
        } else {
          resolve(url);
        }
      }
    );
  });

  const parsedUrl = new URL(responseUrl);

  // PKCE flow: authorization code arrives as a query param (?code=...).
  const code = parsedUrl.searchParams.get('code');
  if (code) {
    const { data: exchangeData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError || !exchangeData.session) {
      throw new Error(exchangeError?.message ?? 'Failed to exchange code for session');
    }
    const session = sessionFromSupabase(exchangeData.session);
    await chrome.storage.local.set({ [SESSION_KEY]: session });
    return session;
  }

  // Implicit flow fallback: tokens arrive in the URL hash (#access_token=...).
  // This happens when the Supabase project is configured for implicit flow.
  const hashParams = new URLSearchParams(parsedUrl.hash.slice(1));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (sessionError || !sessionData.session) {
      throw new Error(sessionError?.message ?? 'Failed to set session from tokens');
    }
    const session = sessionFromSupabase(sessionData.session);
    await chrome.storage.local.set({ [SESSION_KEY]: session });
    return session;
  }

  throw new Error('No authorization code or tokens found in response URL');
}

// ─── T008: getValidSession ────────────────────────────────────────────────────

export async function getValidSession(): Promise<StoredAuthSession | null> {
  const session = await getSession();
  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt - now > REFRESH_THRESHOLD_SECONDS) {
    return session;
  }

  // Access token is near expiry — attempt a silent refresh.
  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: session.refreshToken,
    });
    if (error || !data.session) {
      // Refresh token expired or invalid — clear the session.
      await chrome.storage.local.remove(SESSION_KEY);
      return null;
    }
    const updated = sessionFromSupabase(data.session);
    await chrome.storage.local.set({ [SESSION_KEY]: updated });
    return updated;
  } catch {
    // Network error — return existing session rather than clearing it.
    // The user can still see the main screen; we'll retry on next open.
    return session;
  }
}

// ─── T009: signOut ────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // Best-effort server invalidation; always clear local state.
  }
  await chrome.storage.local.remove(SESSION_KEY);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function sessionFromSupabase(session: Session): StoredAuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt:
      session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    userId: session.user.id,
    githubLogin:
      (session.user.user_metadata?.user_name as string | undefined) ?? '',
    githubEmail: session.user.email ?? null,
  };
}
