import { afterEach, describe, expect, it } from "vitest";
import { resolveOAuthBaseUrl } from "@/lib/oauth/base-url";

describe("resolveOAuthBaseUrl", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("uses request origin on localhost when ports differ", () => {
    process.env.NODE_ENV = "development";
    const request = new Request("http://localhost:3002/api/google/auth");
    expect(resolveOAuthBaseUrl(request, "http://localhost:3000")).toBe(
      "http://localhost:3002",
    );
  });

  it("uses configured URL in production", () => {
    process.env.NODE_ENV = "production";
    const request = new Request("http://localhost:3002/api/google/auth");
    expect(resolveOAuthBaseUrl(request, "https://app.storepilot.ai")).toBe(
      "https://app.storepilot.ai",
    );
  });
});
