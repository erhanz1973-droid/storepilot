import type { StoreSnapshot } from "@/lib/connectors/types";
import { createCommerceOpportunity } from "./opportunity-schema";
import type { CommerceOpportunity } from "./opportunity-schema";

export function buildKlaviyoInsights(snapshot: StoreSnapshot): CommerceOpportunity[] {
  const klaviyo = snapshot.klaviyoSnapshot;
  if (!klaviyo) return [];

  const results: CommerceOpportunity[] = [];
  const storeRevenue = snapshot.storeMetrics.revenue30d;
  const emailShare = storeRevenue > 0 ? klaviyo.emailAttributedRevenue30d / storeRevenue : 0;
  const flowShare =
    klaviyo.emailAttributedRevenue30d > 0
      ? klaviyo.flowRevenue30d / klaviyo.emailAttributedRevenue30d
      : 0;

  if (emailShare < 0.12 && storeRevenue > 5000) {
    results.push(
      createCommerceOpportunity({
        id: "klaviyo-email-underweight",
        source: "klaviyo",
        severity: "medium",
        confidence: 74,
        title: "Email revenue under-indexed vs store total",
        description: `Email drives ${(emailShare * 100).toFixed(1)}% of store revenue — typical benchmark is 15–25%.`,
        recommendation: "Launch post-purchase and win-back flows; increase campaign cadence.",
        category: "conversion",
        supportingMetrics: [
          { label: "Email revenue (30d)", value: `$${klaviyo.emailAttributedRevenue30d.toLocaleString()}` },
          { label: "Store revenue (30d)", value: `$${storeRevenue.toLocaleString()}` },
          { label: "Email share", value: `${(emailShare * 100).toFixed(1)}%`, trend: "down" },
        ],
        expectedImpact: { revenueMonthly: Math.round(storeRevenue * 0.05), label: "" },
        futureAction: "create_email_campaign",
      }),
    );
  }

  if (flowShare < 0.35 && klaviyo.flowRevenue30d > 0) {
    results.push(
      createCommerceOpportunity({
        id: "klaviyo-flow-opportunity",
        source: "klaviyo",
        severity: "low",
        confidence: 70,
        title: "Flows under-contributing vs campaigns",
        description: `Flows are ${(flowShare * 100).toFixed(0)}% of email revenue — automation usually drives 40%+.`,
        recommendation: "Add browse-abandon, cart-abandon, and replenishment flows.",
        category: "conversion",
        supportingMetrics: [
          { label: "Flow revenue (30d)", value: `$${klaviyo.flowRevenue30d.toLocaleString()}` },
          { label: "Campaign revenue (30d)", value: `$${klaviyo.campaignRevenue30d.toLocaleString()}` },
          { label: "Flow share", value: `${(flowShare * 100).toFixed(0)}%` },
        ],
        expectedImpact: { revenueMonthly: Math.round(klaviyo.campaignRevenue30d * 0.2), label: "" },
        futureAction: "create_email_campaign",
      }),
    );
  }

  if (klaviyo.smsAttributedRevenue30d < klaviyo.emailAttributedRevenue30d * 0.1 && klaviyo.orders30d > 50) {
    results.push(
      createCommerceOpportunity({
        id: "klaviyo-sms-opportunity",
        source: "klaviyo",
        severity: "low",
        confidence: 65,
        title: "SMS channel underutilized",
        description: `SMS revenue $${klaviyo.smsAttributedRevenue30d.toLocaleString()} vs email $${klaviyo.emailAttributedRevenue30d.toLocaleString()}.`,
        recommendation: "Test SMS for flash sales and back-in-stock alerts on hero SKUs.",
        category: "pricing",
        supportingMetrics: [
          { label: "SMS revenue (30d)", value: `$${klaviyo.smsAttributedRevenue30d.toLocaleString()}` },
          { label: "Email revenue (30d)", value: `$${klaviyo.emailAttributedRevenue30d.toLocaleString()}` },
        ],
        expectedImpact: { revenueMonthly: Math.round(klaviyo.emailAttributedRevenue30d * 0.08), label: "" },
        futureAction: "create_email_campaign",
      }),
    );
  }

  return results;
}
