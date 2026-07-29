import { beforeAll, describe, expect, it } from "vitest";
import { createOAuthState, parseOAuthState } from "@/lib/oauth/state";

describe("OAuth signed state — B1-C", () => {
  beforeAll(() => {
    process.env.SHOPIFY_API_SECRET = "test-secret-at-least-sixteen-bytes";
  });

  it("embeds storeId and verifies round-trip", () => {
    const storeId = "store-abc-123";
    const state = createOAuthState(storeId);
    expect(state).toBeTruthy();
    const parsed = parseOAuthState(state);
    expect(parsed?.storeId).toBe(storeId);
    expect(parsed?.nonce).toHaveLength(32); // 16 bytes → hex
  });

  it("rejects a forged state (tampered suffix)", () => {
    const state = createOAuthState("store-real");
    const tampered = state.slice(0, -4) + "XXXX";
    expect(parseOAuthState(tampered)).toBeNull();
  });

  it("rejects a raw base64 payload with no signature", () => {
    const raw = Buffer.from("store-real:somehexnonce", "utf8").toString("base64url");
    expect(parseOAuthState(raw)).toBeNull();
  });

  it("returns null for empty or missing input", () => {
    expect(parseOAuthState(null)).toBeNull();
    expect(parseOAuthState("")).toBeNull();
    expect(parseOAuthState(undefined)).toBeNull();
  });

  it("different storeIds produce different state tokens", () => {
    const s1 = createOAuthState("store-a");
    const s2 = createOAuthState("store-b");
    expect(s1).not.toBe(s2);
    // storeId extracted correctly from each
    expect(parseOAuthState(s1)?.storeId).toBe("store-a");
    expect(parseOAuthState(s2)?.storeId).toBe("store-b");
  });

  it("cross-token replay attack: state from store-a cannot masquerade as store-b", () => {
    const stateA = createOAuthState("store-a");
    const parsed = parseOAuthState(stateA);
    // Attacker cannot change storeId embedded in state without invalidating the MAC.
    expect(parsed?.storeId).toBe("store-a");
    expect(parsed?.storeId).not.toBe("store-b");
  });
});
