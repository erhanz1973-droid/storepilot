import { describe, expect, it } from "vitest";
import {
  isMarketingHost,
  normalizeHost,
  resolveRequestHost,
} from "@/lib/marketing/site";

function headersFrom(record: Record<string, string>): Headers {
  const h = new Headers();
  for (const [key, value] of Object.entries(record)) {
    h.set(key, value);
  }
  return h;
}

describe("normalizeHost", () => {
  it("strips port and lowercases", () => {
    expect(normalizeHost("StorePilotAI.pro:443")).toBe("storepilotai.pro");
  });

  it("uses first host from x-forwarded-host list", () => {
    expect(normalizeHost("www.storepilotai.pro, internal.railway")).toBe("www.storepilotai.pro");
  });
});

describe("resolveRequestHost", () => {
  it("prefers x-forwarded-host over host", () => {
    const host = resolveRequestHost(
      headersFrom({
        host: "storepilot-production-d591.up.railway.app",
        "x-forwarded-host": "storepilotai.pro",
      }),
    );
    expect(host).toBe("storepilotai.pro");
  });

  it("falls back to host when no proxy headers", () => {
    expect(resolveRequestHost(headersFrom({ host: "storepilotai.pro" }))).toBe("storepilotai.pro");
  });

  it("uses cf-connecting-host when present", () => {
    expect(
      resolveRequestHost(
        headersFrom({
          host: "internal",
          "cf-connecting-host": "www.storepilotai.pro",
        }),
      ),
    ).toBe("www.storepilotai.pro");
  });
});

describe("isMarketingHost", () => {
  it("matches apex and www marketing domains", () => {
    expect(isMarketingHost("storepilotai.pro")).toBe(true);
    expect(isMarketingHost("www.storepilotai.pro")).toBe(true);
  });

  it("does not match Railway app host", () => {
    expect(isMarketingHost("storepilot-production-d591.up.railway.app")).toBe(false);
  });

  it("does not match unknown hosts", () => {
    expect(isMarketingHost("evil.example.com")).toBe(false);
  });
});
