import { describe, expect, it } from "vitest";
import { finalizeSmokeReport } from "@/lib/smoke/suite";

describe("finalizeSmokeReport", () => {
  it("PASSes when there are only warnings", () => {
    const report = finalizeSmokeReport({
      startedAt: new Date().toISOString(),
      baseUrl: "https://example.com",
      checks: [
        {
          name: "Shopify",
          status: "PASS",
          message: "ok",
          durationMs: 10,
        },
        {
          name: "Meta Ads",
          status: "WARNING",
          message: "Meta Ads disconnected",
          durationMs: 5,
        },
      ],
    });
    expect(report.final).toBe("PASS");
    expect(report.ok).toBe(true);
    expect(report.warnings).toHaveLength(1);
    expect(report.failures).toHaveLength(0);
  });

  it("FAILs when any check fails", () => {
    const report = finalizeSmokeReport({
      startedAt: new Date().toISOString(),
      baseUrl: "https://example.com",
      checks: [
        {
          name: "Shopify",
          status: "FAIL",
          message: "missing installation",
          durationMs: 10,
        },
      ],
    });
    expect(report.final).toBe("FAIL");
    expect(report.ok).toBe(false);
  });
});
