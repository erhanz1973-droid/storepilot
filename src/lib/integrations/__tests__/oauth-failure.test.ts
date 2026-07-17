import { describe, expect, it } from "vitest";
import {
  classifyOAuthFailure,
  formatClassifiedErrorMessage,
  parseStoredFailureCode,
} from "@/lib/integrations/oauth-failure";

describe("classifyOAuthFailure", () => {
  it("classifies expired tokens as reconnect", () => {
    const failure = classifyOAuthFailure("meta", "Meta access token has expired");
    expect(failure.kind).toBe("expired_token");
    expect(failure.action).toBe("reconnect");
    expect(failure.requiresReauthorization).toBe(true);
    expect(failure.health).toBe("error");
    expect(failure.message).toMatch(/expired/i);
    expect(failure.message.toLowerCase()).not.toContain("connection error");
  });

  it("classifies invalid credentials as reconnect", () => {
    const failure = classifyOAuthFailure("google_ads", "Unauthorized 401 invalid_token");
    expect(failure.kind).toBe("invalid_credentials");
    expect(failure.action).toBe("reconnect");
  });

  it("classifies revoked access as reconnect", () => {
    const failure = classifyOAuthFailure(
      "ga4",
      "The user has not authorized application — token revoked",
    );
    expect(failure.kind).toBe("revoked_access");
    expect(failure.action).toBe("reconnect");
  });

  it("classifies missing permissions as reconnect", () => {
    const failure = classifyOAuthFailure("shopify", "403 Forbidden permission_denied");
    expect(failure.kind).toBe("missing_permissions");
    expect(failure.action).toBe("reconnect");
  });

  it("classifies rate limits as wait_and_retry", () => {
    const failure = classifyOAuthFailure("meta", "Rate limit exceeded (429)");
    expect(failure.kind).toBe("rate_limit");
    expect(failure.action).toBe("wait_and_retry");
    expect(failure.health).toBe("degraded");
    expect(failure.requiresReauthorization).toBe(false);
  });

  it("classifies temporary API failures as retry", () => {
    const failure = classifyOAuthFailure("ga4", "503 Service Unavailable temporarily");
    expect(failure.kind).toBe("temporary_api_failure");
    expect(failure.action).toBe("retry");
  });

  it("classifies not configured", () => {
    const failure = classifyOAuthFailure("meta", "Meta OAuth is not configured");
    expect(failure.kind).toBe("not_configured");
    expect(failure.action).toBe("configure");
  });

  it("formats and parses stored error codes", () => {
    const failure = classifyOAuthFailure("meta", "token expired");
    const stored = formatClassifiedErrorMessage(failure);
    expect(stored.startsWith("OAUTH_")).toBe(true);
    expect(parseStoredFailureCode(stored)).toBe(failure.code);
  });
});
