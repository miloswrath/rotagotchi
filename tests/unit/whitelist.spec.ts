const whitelistPath = path.resolve(__dirname, "../../lib/whitelist.json");
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("whitelist.json", () => {
  const whitelistPath = path.resolve(__dirname, "../../lib/whitelist.json");
  const whitelist: string[] = JSON.parse(
    fs.readFileSync(whitelistPath, "utf-8")
  );

  it("should be a JSON array", () => {
    expect(Array.isArray(whitelist)).toBe(true);
  });

  it("should contain only strings", () => {
    whitelist.forEach((domain) => {
      expect(typeof domain).toBe("string");
    });
  });

  it("should include expected domains", () => {
    const expectedDomains = ["youtube.com", "instagram.com"];
    expectedDomains.forEach((domain) => {
      expect(whitelist).toContain(domain);
    });
  });
});
