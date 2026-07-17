import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureMetaAccessToken,
  isMetaTokenExpired,
  isMetaTokenWithinRefreshWindow,
  META_TOKEN_REFRESH_WINDOW_MS,
} from "@/lib/meta/token-lifecycle";

vi.mock("@/lib/meta/oauth", () => ({
  isMetaOAuthConfigured: vi.fn(() => true),
  exchangeForLongLivedMetaToken: vi.fn(),
}));

import {
  exchangeForLongLivedMetaToken,
  isMetaOAuthConfigured,
} from "@/lib/meta/oauth";

const mockedExchange = vi.mocked(exchangeForLongLivedMetaToken);
const mockedConfigured = vi.mocked(isMetaOAuthConfigured);

describe("Meta token lifecycle helpers", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockedConfigured.mockReturnValue(true);
  });

  it("detects expired tokens", () => {
    expect(isMetaTokenExpired(new Date(Date.now() - 60_000).toISOString())).toBe(true);
    expect(isMetaTokenExpired(new Date(Date.now() + 60_000).toISOString())).toBe(false);
    expect(isMetaTokenExpired(null)).toBe(false);
  });

  it("detects refresh window", () => {
    const inside = new Date(Date.now() + META_TOKEN_REFRESH_WINDOW_MS / 2).toISOString();
    const outside = new Date(Date.now() + META_TOKEN_REFRESH_WINDOW_MS * 2).toISOString();
    expect(isMetaTokenWithinRefreshWindow(inside)).toBe(true);
    expect(isMetaTokenWithinRefreshWindow(outside)).toBe(false);
  });

  it("returns reconnect_required when token is already expired", async () => {
    const result = await ensureMetaAccessToken({
      accessToken: "old-token",
      tokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(result.status).toBe("reconnect_required");
    if (result.status === "reconnect_required") {
      expect(result.failure.kind).toBe("expired_token");
      expect(result.failure.action).toBe("reconnect");
      expect(result.accessToken).toBeNull();
    }
    expect(mockedExchange).not.toHaveBeenCalled();
  });

  it("returns valid when expiry is far away", async () => {
    const result = await ensureMetaAccessToken({
      accessToken: "current-token",
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(result).toEqual({
      status: "valid",
      accessToken: "current-token",
      refreshed: false,
    });
    expect(mockedExchange).not.toHaveBeenCalled();
  });

  it("refreshes when inside the window", async () => {
    mockedExchange.mockResolvedValue({
      access_token: "new-long-lived",
      token_type: "bearer",
      expires_in: 60 * 24 * 60 * 60,
    });
    const result = await ensureMetaAccessToken({
      accessToken: "near-expiry",
      tokenExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(result.status).toBe("refreshed");
    if (result.status === "refreshed") {
      expect(result.accessToken).toBe("new-long-lived");
      expect(result.tokenExpiresAt).toBeTruthy();
    }
    expect(mockedExchange).toHaveBeenCalledWith("near-expiry");
  });

  it("requires reconnect when refresh fails with auth error", async () => {
    mockedExchange.mockRejectedValue(new Error("Error validating access token: Session has expired"));
    const result = await ensureMetaAccessToken({
      accessToken: "near-expiry",
      tokenExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(result.status).toBe("reconnect_required");
    if (result.status === "reconnect_required") {
      expect(result.failure.requiresReauthorization).toBe(true);
    }
  });
});
