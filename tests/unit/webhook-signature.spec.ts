import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyWebhookSignature } from "@/lib/github/webhook";

const SECRET = "test-webhook-secret";

function makeSignature(body: string): string {
  return `sha256=${createHmac("sha256", SECRET).update(body, "utf8").digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  it("returns true for a valid signature", () => {
    const body = JSON.stringify({ action: "push" });
    const sig = makeSignature(body);
    expect(verifyWebhookSignature(body, sig, SECRET)).toBe(true);
  });

  it("returns false when body has been tampered with", () => {
    const body = JSON.stringify({ action: "push" });
    const sig = makeSignature(body);
    const tamperedBody = JSON.stringify({ action: "push", extra: "field" });
    expect(verifyWebhookSignature(tamperedBody, sig, SECRET)).toBe(false);
  });

  it("returns false when the wrong secret is used", () => {
    const body = JSON.stringify({ action: "push" });
    const sig = makeSignature(body);
    expect(verifyWebhookSignature(body, sig, "wrong-secret")).toBe(false);
  });

  it("returns false when signature has no sha256= prefix", () => {
    const body = JSON.stringify({ action: "push" });
    const rawHex = createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
    expect(verifyWebhookSignature(body, rawHex, SECRET)).toBe(false);
  });

  it("returns false when signature uses wrong prefix (sha1=)", () => {
    const body = JSON.stringify({ action: "push" });
    const sig = `sha1=${createHmac("sha1", SECRET).update(body, "utf8").digest("hex")}`;
    expect(verifyWebhookSignature(body, sig, SECRET)).toBe(false);
  });

  it("returns false for an empty signature string", () => {
    const body = JSON.stringify({ action: "push" });
    expect(verifyWebhookSignature(body, "", SECRET)).toBe(false);
  });

  it("returns true for an empty body with a valid signature for that empty body", () => {
    const body = "";
    const sig = makeSignature(body);
    expect(verifyWebhookSignature(body, sig, SECRET)).toBe(true);
  });

  it("returns false for a valid-prefix signature with wrong hex value", () => {
    const body = JSON.stringify({ action: "push" });
    expect(verifyWebhookSignature(body, "sha256=deadbeef", SECRET)).toBe(false);
  });
});
