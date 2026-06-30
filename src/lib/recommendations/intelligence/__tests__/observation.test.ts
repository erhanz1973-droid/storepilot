import { describe, expect, it } from "vitest";
import { getObservationDays, observationLabel } from "@/lib/recommendations/intelligence/observation";

describe("recommendation observation windows", () => {
  it("uses 7 days for campaign review", () => {
    expect(getObservationDays("campaign_review")).toBe(7);
    expect(observationLabel("campaign_review")).toBe("7 days");
  });

  it("uses 14 days for inventory and promotions", () => {
    expect(getObservationDays("low_inventory")).toBe(14);
    expect(getObservationDays("promotion_opportunity")).toBe(14);
  });

  it("uses 30 days for homepage merchandising", () => {
    expect(getObservationDays("homepage_merchandising")).toBe(30);
  });
});
