import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  hasServiceSecret,
  isApiPath,
  isPublicApiPath,
} from "@/lib/api/route-auth";

describe("route-auth classification", () => {
  it("recognizes API paths", () => {
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/api/dashboard")).toBe(true);
    expect(isApiPath("/dashboard")).toBe(false);
    expect(isApiPath("/apix")).toBe(false);
  });

  it("marks intentionally public endpoints as public", () => {
    const publicPaths = [
      "/api/shopify/auth",
      "/api/shopify/callback",
      "/api/shopify/bootstrap",
      "/api/shopify/webhooks",
      "/api/ga4/auth",
      "/api/ga4/callback",
      "/api/google/auth",
      "/api/google/callback",
      "/api/meta/auth",
      "/api/meta/callback",
      "/api/cron/ga4-sync",
      "/api/internal/smoke",
      "/api/dev/simulation",
      "/api/demo/scenario",
      "/api/debug",
      "/api/validation/meta",
    ];
    for (const path of publicPaths) {
      expect(isPublicApiPath(path), path).toBe(true);
    }
  });

  it("requires auth for merchant-data endpoints", () => {
    const protectedPaths = [
      "/api/dashboard",
      "/api/recommendations",
      "/api/recommendations/abc/approve",
      "/api/approvals",
      "/api/shopify/sync",
      "/api/live/metrics",
      "/api/store/business-profile",
      "/api/product-costs",
      "/api/ask-ai/chat",
      "/api/ga4/sync",
      "/api/meta/accounts",
      "/api/google/accounts",
      "/api/learning/measure",
      "/api/integrations",
      "/api/history",
      "/api/profit",
      "/api/roas",
      "/api/attribution",
      "/api/autopilot",
      "/api/evidence",
      "/api/simulations",
      "/api/first-run/analyze",
      "/api/feedback",
      "/api/decisions/action",
      "/api/opportunity-history",
    ];
    for (const path of protectedPaths) {
      expect(isPublicApiPath(path), path).toBe(false);
    }
  });
});

describe("hasServiceSecret", () => {
  beforeEach(() => {
    process.env.SMOKE_SECRET = "smoke-secret-value";
    process.env.STOREPILOT_INTERNAL_SECRET = "internal-secret-value";
    process.env.CRON_SECRET = "cron-secret-value";
  });

  afterEach(() => {
    delete process.env.SMOKE_SECRET;
    delete process.env.STOREPILOT_INTERNAL_SECRET;
    delete process.env.CRON_SECRET;
  });

  it("accepts SMOKE_SECRET bearer", () => {
    const request = new Request("https://app.example.com/api/dashboard", {
      headers: { Authorization: "Bearer smoke-secret-value" },
    });
    expect(hasServiceSecret(request)).toBe(true);
  });

  it("accepts x-smoke-secret header", () => {
    const request = new Request("https://app.example.com/api/dashboard", {
      headers: { "x-smoke-secret": "smoke-secret-value" },
    });
    expect(hasServiceSecret(request)).toBe(true);
  });

  it("rejects unknown secrets", () => {
    const request = new Request("https://app.example.com/api/dashboard", {
      headers: { Authorization: "Bearer attacker-token" },
    });
    expect(hasServiceSecret(request)).toBe(false);
  });

  it("rejects requests with no secret", () => {
    const request = new Request("https://app.example.com/api/dashboard");
    expect(hasServiceSecret(request)).toBe(false);
  });
});

describe("Sprint 1C security invariants in source", () => {
  it("middleware enforces session tokens on protected API routes", () => {
    const middleware = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");
    expect(middleware).toContain("guardProtectedApi");
    expect(middleware).toContain("verifyShopifySessionToken");
    expect(middleware).toContain("missing_session_token");
    expect(middleware).toContain("isPublicApiPath");
  });

  it("does not trust client-supplied store_id on OAuth start routes", () => {
    for (const file of [
      "src/app/api/ga4/auth/route.ts",
      "src/app/api/google/auth/route.ts",
      "src/app/api/meta/auth/route.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).not.toContain('searchParams.get("store_id")');
      expect(source).toContain("resolveActiveStoreId");
    }
  });

  it("scopes recommendation-by-id access to the authenticated store", () => {
    for (const file of [
      "src/app/api/recommendations/[id]/route.ts",
      "src/app/api/recommendations/[id]/approve/route.ts",
      "src/app/api/recommendations/[id]/reject/route.ts",
      "src/app/api/recommendations/[id]/dismiss/route.ts",
      "src/app/api/approvals/route.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).toContain("resolveActiveStoreId");
      expect(source).toMatch(/storeId/);
    }
  });

  it("never falls back to a global active Shopify installation for tenant selection", () => {
    const context = readFileSync(join(process.cwd(), "src/lib/store/context.ts"), "utf8");
    expect(context).not.toMatch(/source:\s*"active_installation"/);
    expect(context).toContain("demo_fallback");
  });
});
