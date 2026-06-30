import type { StoreSnapshot } from "@/lib/connectors/types";
import { createCommerceOpportunity } from "./opportunity-schema";
import type { CommerceOpportunity } from "./opportunity-schema";

function topFunnelDropOff(snapshot: StoreSnapshot): {
  step: string;
  dropPct: number;
  from: number;
  to: number;
} | null {
  const ga4 = snapshot.ga4Snapshot;
  const events = ga4?.funnelEvents;
  if (!events || events.productViews30d <= 0) return null;

  const steps = [
    { step: "Product view → Add to cart", from: events.productViews30d, to: events.addToCart30d },
    { step: "Add to cart → Checkout", from: events.addToCart30d, to: events.checkout30d },
    { step: "Checkout → Purchase", from: events.checkout30d, to: events.purchases30d },
  ].filter((s) => s.from > 0);

  if (steps.length === 0) return null;

  const worst = steps.reduce((a, b) => {
    const dropA = 1 - a.to / a.from;
    const dropB = 1 - b.to / b.from;
    return dropB > dropA ? b : a;
  });

  return {
    step: worst.step,
    dropPct: Math.round((1 - worst.to / worst.from) * 100),
    from: worst.from,
    to: worst.to,
  };
}

export function buildGa4Insights(snapshot: StoreSnapshot): CommerceOpportunity[] {
  const ga4 = snapshot.ga4Snapshot;
  if (!ga4 || ga4.sessions30d <= 0) return [];

  const results: CommerceOpportunity[] = [];
  const storeRevenue = snapshot.storeMetrics.revenue30d;
  const revPerSession = storeRevenue > 0 ? storeRevenue / ga4.sessions30d : 0;

  for (const page of ga4.landingPages) {
    const pageRps = page.sessions > 0 ? page.revenue / page.sessions : 0;
    if (page.sessions >= 2000 && revPerSession > 0 && pageRps < revPerSession * 0.45) {
      results.push(
        createCommerceOpportunity({
          id: `ga4-landing-${page.path.replace(/\W/g, "-")}`,
          source: "ga4",
          severity: "medium",
          confidence: 72,
          title: `Low-converting landing page — ${page.path}`,
          description: `${page.sessions.toLocaleString()} sessions but only $${page.revenue.toLocaleString()} revenue (30d).`,
          recommendation: "Improve PDP layout, speed, and above-the-fold offer on this entry page.",
          category: "conversion",
          supportingMetrics: [
            { label: "Sessions (30d)", value: page.sessions.toLocaleString() },
            { label: "Revenue (30d)", value: `$${page.revenue.toLocaleString()}` },
            { label: "Rev / session", value: `$${pageRps.toFixed(2)}`, trend: "down" },
          ],
          expectedImpact: { revenueMonthly: Math.round(page.sessions * revPerSession * 0.08), label: "" },
        }),
      );
    }

    if (page.sessions >= 1500 && revPerSession > 0 && pageRps > revPerSession * 1.8) {
      results.push(
        createCommerceOpportunity({
          id: `ga4-landing-win-${page.path.replace(/\W/g, "-")}`,
          source: "ga4",
          severity: "low",
          confidence: 74,
          title: `High-performing landing page — ${page.path}`,
          description: `${page.path} converts ${(pageRps / revPerSession).toFixed(1)}x better than site average.`,
          recommendation: "Route more paid and email traffic to this page; replicate layout on underperformers.",
          category: "conversion",
          supportingMetrics: [
            { label: "Sessions (30d)", value: page.sessions.toLocaleString() },
            { label: "Rev / session", value: `$${pageRps.toFixed(2)}`, trend: "up" },
          ],
          expectedImpact: { revenueMonthly: Math.round(page.sessions * revPerSession * 0.12), label: "" },
        }),
      );
    }
  }

  const mobile = ga4.devices.find((d) => d.device === "mobile");
  const desktop = ga4.devices.find((d) => d.device === "desktop");
  if (mobile && desktop && mobile.sessions > 1000 && desktop.sessions > 500) {
    const mobileRps = mobile.revenue / mobile.sessions;
    const desktopRps = desktop.revenue / desktop.sessions;
    if (desktopRps > 0 && mobileRps < desktopRps * 0.55) {
      const gapPct = Math.round((1 - mobileRps / desktopRps) * 100);
      results.push(
        createCommerceOpportunity({
          id: "ga4-mobile-gap",
          source: "ga4",
          severity: "high",
          confidence: 79,
          title: "Mobile users convert worse than desktop",
          description: `Mobile rev/session $${mobileRps.toFixed(2)} vs desktop $${desktopRps.toFixed(2)} (${gapPct}% gap).`,
          recommendation: "Improve mobile checkout, sticky ATC, and page speed on top landing pages.",
          category: "conversion",
          supportingMetrics: [
            { label: "Mobile sessions", value: mobile.sessions.toLocaleString() },
            { label: "Mobile rev/session", value: `$${mobileRps.toFixed(2)}`, trend: "down" },
            { label: "Desktop rev/session", value: `$${desktopRps.toFixed(2)}` },
          ],
          expectedImpact: { revenueMonthly: Math.round(mobile.sessions * (desktopRps - mobileRps) * 0.15), label: "" },
        }),
      );
    }
  }

  const paid = ga4.sourceMedium.filter((r) => /cpc|paid|ppc/i.test(r.medium));
  const organic = ga4.sourceMedium.filter((r) => /organic|referral/i.test(r.medium));
  const paidSessions = paid.reduce((s, r) => s + r.sessions, 0);
  const organicSessions = organic.reduce((s, r) => s + r.sessions, 0);
  const paidRevenue = paid.reduce((s, r) => s + r.revenue, 0);
  const organicRevenue = organic.reduce((s, r) => s + r.revenue, 0);
  if (organicSessions > paidSessions * 0.5 && organicRevenue > paidRevenue * 1.2) {
    results.push(
      createCommerceOpportunity({
        id: "ga4-organic-outperform",
        source: "ga4",
        severity: "low",
        confidence: 68,
        title: "Organic traffic has the highest profit efficiency",
        description: "Organic/referral drives stronger revenue per session than paid channels.",
        recommendation: "Shift budget toward SEO content and email capture; trim low-intent paid.",
        category: "channel_comparison",
        supportingMetrics: [
          { label: "Organic sessions", value: organicSessions.toLocaleString() },
          { label: "Organic revenue", value: `$${organicRevenue.toLocaleString()}`, trend: "up" },
          { label: "Paid revenue", value: `$${paidRevenue.toLocaleString()}` },
        ],
        expectedImpact: { profitMonthly: Math.round(paidRevenue * 0.05), label: "" },
      }),
    );
  }

  if (ga4.channelGroups?.length) {
    const ranked = [...ga4.channelGroups]
      .filter((c) => c.sessions >= 500)
      .map((c) => ({ ...c, rps: c.sessions > 0 ? c.revenue / c.sessions : 0 }))
      .sort((a, b) => b.rps - a.rps);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (best && worst && best.rps > worst.rps * 2 && worst.sessions >= 1000) {
      results.push(
        createCommerceOpportunity({
          id: "ga4-channel-efficiency",
          source: "ga4",
          severity: "medium",
          confidence: 71,
          title: `${best.channel} outperforms ${worst.channel} on revenue efficiency`,
          description: `${best.channel} earns $${best.rps.toFixed(2)}/session vs $${worst.rps.toFixed(2)} for ${worst.channel}.`,
          recommendation: `Increase budget on ${best.channel}; audit or reduce spend on ${worst.channel}.`,
          category: "channel_comparison",
          supportingMetrics: [
            { label: best.channel, value: `$${best.rps.toFixed(2)}/session`, trend: "up" },
            { label: worst.channel, value: `$${worst.rps.toFixed(2)}/session`, trend: "down" },
          ],
          expectedImpact: { profitMonthly: Math.round(worst.sessions * (best.rps - worst.rps) * 0.1), label: "" },
        }),
      );
    }
  }

  const dropOff = topFunnelDropOff(snapshot);
  if (dropOff && dropOff.dropPct >= 40) {
    results.push(
      createCommerceOpportunity({
        id: "ga4-funnel-dropoff",
        source: "ga4",
        severity: dropOff.step.includes("Checkout") ? "high" : "medium",
        confidence: ga4.funnelEvents?.verified ? 82 : 65,
        title: `Biggest funnel drop-off: ${dropOff.step}`,
        description: `${dropOff.dropPct}% of users abandon between ${dropOff.from.toLocaleString()} and ${dropOff.to.toLocaleString()} (30d).`,
        recommendation: dropOff.step.includes("Checkout")
          ? "Fix checkout abandonment — simplify steps, add trust badges, and test guest checkout."
          : "Improve product pages and add-to-cart UX to reduce early funnel loss.",
        category: "conversion",
        supportingMetrics: [
          { label: "Drop-off rate", value: `${dropOff.dropPct}%`, trend: "down" },
          { label: "From", value: dropOff.from.toLocaleString() },
          { label: "To", value: dropOff.to.toLocaleString() },
        ],
        expectedImpact: {
          revenueMonthly: Math.round(dropOff.from * revPerSession * (dropOff.dropPct / 100) * 0.2),
          label: "",
        },
      }),
    );
  }

  if (ga4.engagementRatePct != null && ga4.engagementRatePct < 45 && ga4.sessions30d > 5000) {
    results.push(
      createCommerceOpportunity({
        id: "ga4-low-engagement",
        source: "ga4",
        severity: "medium",
        confidence: 70,
        title: "Site engagement is below benchmark",
        description: `Engagement rate is ${ga4.engagementRatePct.toFixed(0)}% — many sessions exit without meaningful interaction.`,
        recommendation: "Improve page speed, internal linking, and hero messaging on top landing pages.",
        category: "conversion",
        supportingMetrics: [
          { label: "Engagement rate", value: `${ga4.engagementRatePct.toFixed(0)}%`, trend: "down" },
          { label: "Sessions (30d)", value: ga4.sessions30d.toLocaleString() },
        ],
        expectedImpact: { revenueMonthly: Math.round(ga4.sessions30d * revPerSession * 0.06), label: "" },
      }),
    );
  }

  if (ga4.returningUserRatePct != null && ga4.returningUserRatePct >= 55 && ga4.purchaseRevenue30d) {
    const returningShare = ga4.returningUserRatePct;
    results.push(
      createCommerceOpportunity({
        id: "ga4-returning-revenue",
        source: "ga4",
        severity: "low",
        confidence: 73,
        title: "Returning customers drive a large share of traffic",
        description: `${returningShare.toFixed(0)}% of users are returning — loyalty and email programs have strong leverage.`,
        recommendation: "Launch win-back flows and VIP offers to convert returning visitors faster.",
        category: "retention",
        supportingMetrics: [
          { label: "Returning users", value: `${returningShare.toFixed(0)}%` },
          { label: "GA4 revenue (30d)", value: `$${ga4.purchaseRevenue30d.toLocaleString()}`, trend: "up" },
        ],
        expectedImpact: { revenueMonthly: Math.round((ga4.purchaseRevenue30d ?? 0) * 0.08), label: "" },
      }),
    );
  }

  return results;
}
