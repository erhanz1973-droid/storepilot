import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_OBJECTIVE_LABELS,
  classifyCampaignObjective,
  OBJECTIVE_METRIC_PROFILES,
  OBJECTIVE_ROAS_WEIGHT,
} from "@/lib/meta/campaign-objectives";

const base = {
  id: "1",
  name: "Test",
  status: "ACTIVE" as const,
  effectiveStatus: "ACTIVE" as const,
  metaEffectiveStatus: "ACTIVE",
  spend7d: 100,
  revenue7d: 0,
  roas7d: 0,
  ctr7d: 1,
  frequency7d: 2,
  impressions7d: 5000,
};

describe("campaign objectives", () => {
  it("exposes all supported objective labels", () => {
    expect(Object.keys(CAMPAIGN_OBJECTIVE_LABELS)).toEqual([
      "sales",
      "catalog_sales",
      "leads",
      "traffic",
      "brand_awareness",
      "reach",
      "engagement",
      "messages",
      "video_views",
      "app_installs",
    ]);
  });

  it("assigns very low ROAS weight to awareness and video objectives", () => {
    expect(OBJECTIVE_ROAS_WEIGHT.brand_awareness).toBeLessThan(0.1);
    expect(OBJECTIVE_ROAS_WEIGHT.video_views).toBeLessThan(0.1);
    expect(OBJECTIVE_ROAS_WEIGHT.sales).toBe(1);
  });

  it("maps traffic and app install objectives", () => {
    expect(classifyCampaignObjective({ ...base, objective: "OUTCOME_TRAFFIC" })).toBe("traffic");
    expect(classifyCampaignObjective({ ...base, objective: "OUTCOME_APP_PROMOTION" })).toBe(
      "app_installs",
    );
    expect(classifyCampaignObjective({ ...base, objective: "PRODUCT_CATALOG_SALES" })).toBe(
      "catalog_sales",
    );
    expect(classifyCampaignObjective({ ...base, objective: "MESSAGES" })).toBe("messages");
  });

  it("documents primary metrics per objective", () => {
    expect(OBJECTIVE_METRIC_PROFILES.sales.primaryMetrics).toContain("ROAS");
    expect(OBJECTIVE_METRIC_PROFILES.brand_awareness.primaryMetrics).toContain("Reach");
    expect(OBJECTIVE_METRIC_PROFILES.video_views.primaryMetrics).toContain("ThruPlay");
    expect(OBJECTIVE_METRIC_PROFILES.leads.primaryMetrics).toContain("CPL");
  });
});
