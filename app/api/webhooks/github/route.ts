import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, processWebhookEvent, handleInstallationEvent } from "@/lib/github/webhook";
import { createServiceRoleClient } from "@/lib/supabase/server";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? "";

export async function POST(request: NextRequest) {
  // 1. Capture raw body BEFORE any JSON parsing (required for HMAC verification)
  const rawBody = await request.text();

  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const eventType = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery");

  // 2. Validate required headers
  if (!eventType || !deliveryId) {
    console.error("[webhooks/github] Missing required headers", {
      eventType,
      deliveryId,
    });
    return NextResponse.json(
      { error: "Missing required headers" },
      { status: 400 }
    );
  }

  // 3. Verify HMAC signature before processing
  if (!verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET)) {
    console.error("[webhooks/github] Signature verification failed", {
      eventType,
      deliveryId,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const payload = JSON.parse(rawBody);

  // 4. Handle installation lifecycle events (no webhook_events row needed)
  if (eventType === "installation") {
    try {
      await handleInstallationEvent(payload);
    } catch (err) {
      console.error("[webhooks/github] Installation event handler failed", {
        deliveryId,
        error: String(err),
      });
      return NextResponse.json(
        { error: "Installation handler failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  // 5. Attempt idempotent insert into webhook_events
  const supabase = createServiceRoleClient();

  // Resolve installation_id from payload
  const installationId = (payload as { installation?: { id: number } }).installation?.id;
  if (!installationId) {
    // Event has no installation context — ignore silently
    return NextResponse.json({ ok: true });
  }

  const { error: insertError, count } = await supabase
    .from("webhook_events")
    .insert(
      {
        delivery_id: deliveryId,
        installation_id: installationId,
        event_type: eventType,
        action: (payload as { action?: string }).action ?? null,
        payload,
      },
      { count: "exact" }
    )
    .select();

  if (insertError) {
    // Duplicate delivery (unique constraint on delivery_id) — return 200
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[webhooks/github] Failed to store event", {
      deliveryId,
      eventType,
      error: insertError.message,
    });
    return NextResponse.json({ error: "Storage failed" }, { status: 500 });
  }

  // If nothing was inserted (shouldn't happen outside duplicate, but guard it)
  if (!count || count === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 6. Process push and pull_request events asynchronously
  if (eventType === "push" || eventType === "pull_request") {
    // Fire-and-forget — respond 200 immediately, process in background
    // Railway persistent container keeps the process alive for this
    processWebhookEvent(deliveryId, eventType, payload).catch((err) => {
      console.error("[webhooks/github] Event processing failed", {
        deliveryId,
        eventType,
        error: String(err),
      });
    });
  }

  return NextResponse.json({ ok: true });
}
