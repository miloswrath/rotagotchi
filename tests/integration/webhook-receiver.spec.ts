import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

const SECRET = "test-webhook-secret";

function makeSignature(body: string): string {
  return `sha256=${createHmac("sha256", SECRET).update(body, "utf8").digest("hex")}`;
}

vi.mock("@/lib/github/webhook", () => ({
  verifyWebhookSignature: vi.fn(),
  processWebhookEvent: vi.fn().mockResolvedValue(undefined),
  handleInstallationEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(),
}));

import { verifyWebhookSignature, processWebhookEvent } from "@/lib/github/webhook";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/webhooks/github/route";

function makeWebhookRequest(
  body: string,
  {
    signature,
    eventType = "push",
    deliveryId = "delivery-uuid-001",
  }: { signature?: string; eventType?: string; deliveryId?: string } = {}
) {
  const sig = signature ?? makeSignature(body);
  return new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": sig,
      "x-github-event": eventType,
      "x-github-delivery": deliveryId,
    },
    body,
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/webhooks/github", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when x-github-event header is missing", async () => {
    const body = JSON.stringify({ installation: { id: 1 } });
    const req = new Request("http://localhost:3000/api/webhooks/github", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": makeSignature(body),
        "x-github-delivery": "delivery-001",
        // no x-github-event
      },
      body,
    }) as unknown as Parameters<typeof POST>[0];

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when signature is invalid", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(false);

    const body = JSON.stringify({ installation: { id: 1 } });
    const req = makeWebhookRequest(body, { signature: "sha256=invalid" });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("stores push event and returns 200", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true);

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ error: null, count: 1 }),
    });
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    } as never);

    const body = JSON.stringify({
      installation: { id: 42 },
      repository: { full_name: "user/repo" },
      ref: "refs/heads/main",
      head_commit: { id: "abc123", timestamp: "2026-03-11T00:00:00Z" },
      commits: [{ stats: { additions: 10, deletions: 5 } }],
    });

    const req = makeWebhookRequest(body, {
      eventType: "push",
      deliveryId: "delivery-push-001",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_id: "delivery-push-001",
        event_type: "push",
        installation_id: 42,
      }),
      expect.any(Object)
    );
  });

  it("returns 200 without duplicating on repeated delivery UUID", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true);

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        error: { code: "23505", message: "duplicate key" },
        count: null,
      }),
    });
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    } as never);

    const body = JSON.stringify({ installation: { id: 42 } });
    const req = makeWebhookRequest(body, {
      eventType: "push",
      deliveryId: "duplicate-delivery",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
    expect(processWebhookEvent).not.toHaveBeenCalled();
  });

  it("stores installation event and returns 200 without insert into webhook_events", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true);
    const { handleInstallationEvent } = await import("@/lib/github/webhook");

    const body = JSON.stringify({
      installation: {
        id: 99,
        account: { login: "user", type: "User" },
        repository_selection: "all",
      },
      action: "created",
    });

    const fromMock = vi.fn();
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: fromMock,
    } as never);

    const req = makeWebhookRequest(body, {
      eventType: "installation",
      deliveryId: "install-001",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    // handleInstallationEvent called, not the generic insert path
    expect(handleInstallationEvent).toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });
});
