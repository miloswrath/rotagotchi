import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for app/api/auth/callback/route.ts
 *
 * These tests verify the OAuth callback handler's behavior across
 * the key scenarios defined in spec.md US1 acceptance scenarios.
 *
 * NOTE: These tests mock Supabase and GitHub API calls.
 * Real end-to-end flow is validated via quickstart.md steps.
 */

// Mock modules before importing the route handler
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/github/auth", () => ({
  storeGitHubTokens: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { storeGitHubTokens } from "@/lib/github/auth";
import { GET } from "@/app/api/auth/callback/route";

function makeRequest(url: string) {
  return new Request(url) as unknown as Parameters<typeof GET>[0];
}

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /?auth=error&reason=missing_code when no code param", async () => {
    const req = makeRequest("http://localhost:3000/api/auth/callback");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("auth=error");
    expect(res.headers.get("location")).toContain("reason=missing_code");
  });

  it("redirects to /?auth=error&reason=exchange_failed when Supabase exchange fails", async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: { message: "bad code" } }),
      },
    } as never);

    const req = makeRequest(
      "http://localhost:3000/api/auth/callback?code=bad-code"
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("reason=exchange_failed");
  });

  it("stores tokens and redirects to install URL when no installation exists", async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: "user-123" },
              provider_token: "ghu_abc",
              provider_refresh_token: "ghr_xyz",
            },
          },
          error: null,
        }),
      },
    } as never);

    vi.mocked(storeGitHubTokens).mockResolvedValue(undefined);

    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as never);

    const req = makeRequest(
      "http://localhost:3000/api/auth/callback?code=valid-code"
    );
    const res = await GET(req);

    expect(storeGitHubTokens).toHaveBeenCalledWith(
      "user-123",
      "ghu_abc",
      "ghr_xyz",
      expect.any(Date),
      expect.any(Date)
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("github.com/apps");
  });

  it("redirects to /?auth=success when installation exists", async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: "user-456" },
              provider_token: "ghu_def",
              provider_refresh_token: "ghr_uvw",
            },
          },
          error: null,
        }),
      },
    } as never);

    vi.mocked(storeGitHubTokens).mockResolvedValue(undefined);

    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: "install-1" },
          error: null,
        }),
      }),
    } as never);

    const req = makeRequest(
      "http://localhost:3000/api/auth/callback?code=valid-code-with-install"
    );
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("auth=success");
  });
});
