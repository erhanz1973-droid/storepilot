import type { AttributionDashboard } from "@/lib/attribution/models";
import { CHANNEL_LABELS } from "@/lib/attribution/models";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type {
  FunnelAiInsight,
  FunnelAvailableMetric,
  FunnelBottleneck,
  FunnelConfidence,
  FunnelDataTier,
  FunnelOptimizationAction,
  FunnelPageView,
  FunnelStepView,
  FunnelTrafficSource,
} from "./types";

function metric(
  id: string,
  label: string,
  value: string,
  status: FunnelConfidence,
  notice?: string,
): FunnelAvailableMetric {
  return { id, label, value, status, notice };
}

function hasVerifiedFunnelEvents(snapshot: StoreSnapshot): boolean {
  const events = snapshot.ga4Snapshot?.funnelEvents;
  return Boolean(events?.verified && events.productViews30d > 0);
}

function resolveDataTier(snapshot: StoreSnapshot): FunnelDataTier {
  if (hasVerifiedFunnelEvents(snapshot)) return "step_level";
  if (snapshot.ga4Snapshot?.sessions30d) return "session_level";
  return "commerce_only";
}

function dataTierLabel(tier: FunnelDataTier): string {
  switch (tier) {
    case "step_level":
      return "Step-level funnel";
    case "session_level":
      return "Session-level conversion";
    default:
      return "Commerce & channel signals";
  }
}

function buildConfidence(
  tier: FunnelDataTier,
  snapshot: StoreSnapshot,
): { confidence: FunnelConfidence; score: number; notice: string } {
  if (tier === "commerce_only") {
    return {
      confidence: "estimated",
      score: 52,
      notice: "Optimizations use Shopify orders and attributed channel performance.",
    };
  }
  if (tier === "session_level") {
    return {
      confidence: "estimated",
      score: 68,
      notice: "Session-to-purchase CVR is verified; step-level drop-offs need ecommerce events in GA4.",
    };
  }
  const events = snapshot.ga4Snapshot!.funnelEvents!;
  const ordersMatch =
    Math.abs(events.purchases30d - snapshot.storeMetrics.orders30d) /
      Math.max(snapshot.storeMetrics.orders30d, 1) <
    0.05;
  return {
    confidence: ordersMatch ? "verified" : "estimated",
    score: ordersMatch ? 92 : 76,
    notice: ordersMatch
      ? "Funnel steps verified against GA4 events and Shopify orders."
      : "Funnel events synced — purchase counts differ slightly from Shopify.",
  };
}

function buildAvailableMetrics(snapshot: StoreSnapshot, tier: FunnelDataTier): FunnelAvailableMetric[] {
  const m = snapshot.storeMetrics;
  const ga4 = snapshot.ga4Snapshot;
  const hasGa4 = Boolean(ga4?.sessions30d);

  const cvr =
    hasGa4 && ga4!.sessions30d > 0
      ? (m.orders30d / ga4!.sessions30d) * 100
      : m.conversionRate30d > 0
        ? m.conversionRate30d
        : null;

  const metrics: FunnelAvailableMetric[] = [];

  if (hasGa4) {
    metrics.push(
      metric("sessions", "Sessions", ga4!.sessions30d.toLocaleString(), "verified", "From GA4"),
    );
  }

  metrics.push(
    metric("orders", "Orders", m.orders30d.toLocaleString(), "verified", "From Shopify"),
    metric(
      "cvr",
      "Conversion Rate",
      cvr != null ? `${cvr.toFixed(2)}%` : "—",
      hasGa4 ? "verified" : m.conversionRate30d > 0 ? "estimated" : "unavailable",
      hasGa4 ? "Orders ÷ GA4 sessions" : "Store benchmark estimate",
    ),
    metric("revenue", "Revenue", `$${m.revenue30d.toLocaleString()}`, "verified", "From Shopify"),
    metric(
      "aov",
      "Average Order Value",
      m.orders30d > 0 ? `$${Math.round(m.aov30d)}` : "—",
      "verified",
      "Revenue ÷ orders",
    ),
  );

  if (tier === "step_level" && ga4?.funnelEvents) {
    const atcRate =
      ga4.funnelEvents.productViews30d > 0
        ? (ga4.funnelEvents.addToCart30d / ga4.funnelEvents.productViews30d) * 100
        : null;
    if (atcRate != null) {
      metrics.push(
        metric("atc_rate", "Add-to-cart rate", `${atcRate.toFixed(1)}%`, "verified", "Product views → ATC"),
      );
    }
  }

  return metrics;
}

function buildTrafficSources(
  snapshot: StoreSnapshot,
  attribution: AttributionDashboard | null,
): FunnelTrafficSource[] {
  const ga4 = snapshot.ga4Snapshot;
  if (ga4?.sourceMedium?.length) {
    const totals = new Map<string, { sessions: number; conversions: number }>();
    for (const row of ga4.sourceMedium) {
      let label = "Other";
      if (row.medium === "cpc" || row.medium === "paid") {
        if (row.source.includes("google")) label = "Google";
        else if (row.source.includes("facebook") || row.source.includes("instagram")) label = "Meta";
        else label = "Paid";
      } else if (row.medium === "organic" || row.source.includes("organic")) {
        label = "Organic";
      } else if (row.medium === "(none)" || row.source === "(direct)") {
        label = "Direct";
      } else if (row.medium === "email") {
        label = "Email";
      } else if (row.medium === "referral") {
        label = "Referral";
      }
      const prev = totals.get(label) ?? { sessions: 0, conversions: 0 };
      totals.set(label, {
        sessions: prev.sessions + row.sessions,
        conversions: prev.conversions + row.conversions,
      });
    }
    const total = [...totals.values()].reduce((s, v) => s + v.sessions, 0);
    return [...totals.entries()]
      .map(([label, v]) => ({
        label,
        sharePct: total > 0 ? Math.round((v.sessions / total) * 1000) / 10 : 0,
        status: "verified" as FunnelConfidence,
        conversionPct: v.sessions > 0 ? Math.round((v.conversions / v.sessions) * 10000) / 100 : null,
      }))
      .sort((a, b) => b.sharePct - a.sharePct);
  }

  if (attribution?.channels.length) {
    const total = attribution.channels.reduce((s, c) => s + c.attributedOrders, 0);
    return attribution.channels
      .filter((c) => c.attributedOrders > 0)
      .map((c) => ({
        label: CHANNEL_LABELS[c.channelId] ?? c.channelLabel,
        sharePct: total > 0 ? Math.round((c.attributedOrders / total) * 1000) / 10 : 0,
        status: "estimated" as FunnelConfidence,
        conversionPct: null,
      }))
      .sort((a, b) => b.sharePct - a.sharePct)
      .slice(0, 6);
  }

  return [];
}

function buildFullFunnelSteps(snapshot: StoreSnapshot): FunnelStepView[] {
  const ga4 = snapshot.ga4Snapshot!;
  const events = ga4.funnelEvents!;
  const aov = snapshot.storeMetrics.aov30d;

  const raw = [
    { id: "sessions", label: "Sessions", users: ga4.sessions30d },
    { id: "views", label: "Product Views", users: events.productViews30d },
    { id: "atc", label: "Add To Cart", users: events.addToCart30d },
    { id: "checkout", label: "Checkout", users: events.checkout30d },
    { id: "purchase", label: "Purchase", users: events.purchases30d },
  ];

  return raw.map((step, i) => {
    const next = raw[i + 1];
    const conversionPct = next ? (next.users / step.users) * 100 : 100;
    const dropOffPct = next ? 100 - conversionPct : 0;
    const lostUsers = next ? step.users - next.users : 0;
    const revenueLost =
      lostUsers > 0 && step.id !== "purchase"
        ? Math.round(lostUsers * (conversionPct / 100) * aov * 0.35)
        : null;

    let recommendation: string | null = null;
    if (step.id === "views" && dropOffPct > 30) {
      recommendation = "Improve product page load speed and above-the-fold imagery.";
    } else if (step.id === "atc" && dropOffPct > 50) {
      recommendation = "Add trust badges and simplify variant selection on product pages.";
    } else if (step.id === "checkout" && dropOffPct > 40) {
      recommendation = "Reduce checkout fields and offer guest checkout.";
    } else if (step.id === "sessions" && dropOffPct > 35) {
      recommendation = "Review landing page relevance for paid traffic sources.";
    }

    return {
      ...step,
      conversionPct: Math.round(conversionPct * 10) / 10,
      dropOffPct: Math.round(dropOffPct * 10) / 10,
      revenueLost,
      revenueLostStatus: revenueLost != null ? "estimated" : "unavailable",
      recommendation,
      status: "verified" as FunnelConfidence,
    };
  });
}

function buildSessionFunnelSteps(snapshot: StoreSnapshot): FunnelStepView[] {
  const ga4 = snapshot.ga4Snapshot!;
  const sessions = ga4.sessions30d;
  const purchases = snapshot.storeMetrics.orders30d;
  const conversionPct = sessions > 0 ? (purchases / sessions) * 100 : 0;
  const dropOffPct = 100 - conversionPct;
  const aov = snapshot.storeMetrics.aov30d;
  const lostUsers = sessions - purchases;
  const revenueLost = lostUsers > 0 ? Math.round(lostUsers * (conversionPct / 100) * aov * 0.25) : null;

  return [
    {
      id: "sessions",
      label: "Sessions",
      users: sessions,
      conversionPct: Math.round(conversionPct * 100) / 100,
      dropOffPct: Math.round(dropOffPct * 100) / 100,
      revenueLost,
      revenueLostStatus: revenueLost != null ? "estimated" : "unavailable",
      recommendation:
        conversionPct < 2
          ? "Session CVR is below typical ecommerce benchmarks — audit landing pages and offer clarity."
          : "Enable GA4 ecommerce events in Connections for step-level abandonment analysis.",
      status: "verified",
    },
    {
      id: "purchase",
      label: "Purchase",
      users: purchases,
      conversionPct: 100,
      dropOffPct: 0,
      revenueLost: null,
      revenueLostStatus: "unavailable",
      recommendation: null,
      status: "verified",
    },
  ];
}

function buildBottleneck(
  steps: FunnelStepView[],
  tier: FunnelDataTier,
  snapshot: StoreSnapshot,
): FunnelBottleneck | null {
  if (steps.length >= 2 && tier === "step_level") {
    const worst = steps
      .slice(0, -1)
      .filter((s) => s.users > 0)
      .reduce((a, b) => (b.dropOffPct > a.dropOffPct ? b : a), steps[0]!);
    const next = steps[steps.indexOf(worst) + 1];
    if (worst.dropOffPct < 15) return null;
    return {
      title: `Biggest drop-off: ${worst.label} → ${next?.label ?? "next step"}`,
      description:
        worst.recommendation ??
        `${worst.dropOffPct.toFixed(0)}% of users leave before the next step.`,
      impactLabel:
        worst.revenueLost != null
          ? `Est. $${worst.revenueLost.toLocaleString()}/mo recoverable`
          : `${(worst.users - (next?.users ?? 0)).toLocaleString()} users lost`,
      focusStep: worst.label,
      confidence: worst.status,
    };
  }

  if (tier === "session_level" && steps[0]) {
    const s = steps[0];
    return {
      title: "Session-to-purchase conversion",
      description: `${s.dropOffPct.toFixed(1)}% of sessions do not convert — focus on traffic quality and checkout friction.`,
      impactLabel:
        s.revenueLost != null
          ? `Est. $${s.revenueLost.toLocaleString()}/mo opportunity`
          : `${(s.users - (steps[1]?.users ?? 0)).toLocaleString()} sessions without purchase`,
      focusStep: "Sessions",
      confidence: "verified",
    };
  }

  const cvr = snapshot.storeMetrics.conversionRate30d;
  if (tier === "commerce_only" && cvr > 0 && cvr < 2.5) {
    return {
      title: "Store conversion below benchmark",
      description: `Estimated ${cvr.toFixed(1)}% CVR — most gains come from product page clarity and checkout simplification.`,
      impactLabel: "Improve CVR before scaling ad spend",
      focusStep: "Store-wide",
      confidence: "estimated",
    };
  }

  return null;
}

function buildOptimizationActions(
  snapshot: StoreSnapshot,
  attribution: AttributionDashboard | null,
  steps: FunnelStepView[],
  tier: FunnelDataTier,
): FunnelOptimizationAction[] {
  const actions: FunnelOptimizationAction[] = [];
  const ga4 = snapshot.ga4Snapshot;
  const m = snapshot.storeMetrics;

  if (steps.length >= 2 && tier === "step_level") {
    for (const step of steps.slice(0, -1)) {
      if (!step.recommendation || step.dropOffPct < 20) continue;
      actions.push({
        id: `step-${step.id}`,
        priority: step.dropOffPct >= 45 ? "critical" : step.dropOffPct >= 30 ? "high" : "medium",
        title: `Fix ${step.label.toLowerCase()} drop-off`,
        description: `${step.dropOffPct.toFixed(0)}% abandon before the next step.`,
        recommendation: step.recommendation,
        expectedMonthlyImpact: step.revenueLost,
        confidenceScore: 0.84,
        focusArea:
          step.id === "checkout"
            ? "checkout"
            : step.id === "views" || step.id === "atc"
              ? "product_page"
              : "traffic",
        dataTier: "verified",
      });
    }
  }

  if (ga4?.sourceMedium?.length) {
    const paid = ga4.sourceMedium.filter((r) => r.medium === "cpc" || r.medium === "paid");
    const byCvr = paid
      .map((r) => ({
        label: r.source.includes("google") ? "Google Ads" : r.source.includes("facebook") ? "Meta Ads" : r.source,
        cvr: r.sessions > 0 ? r.conversions / r.sessions : 0,
        sessions: r.sessions,
      }))
      .filter((r) => r.sessions >= 500)
      .sort((a, b) => a.cvr - b.cvr);

    if (byCvr.length >= 2) {
      const worst = byCvr[0]!;
      const best = byCvr[byCvr.length - 1]!;
      if (best.cvr > worst.cvr * 1.25) {
        const lift = Math.round(((best.cvr - worst.cvr) / worst.cvr) * 100);
        actions.push({
          id: "channel-cvr-gap",
          priority: "high",
          title: `Rebalance spend from ${worst.label}`,
          description: `${best.label} converts ${lift}% better per session than ${worst.label}.`,
          recommendation: `Shift budget toward ${best.label} or improve ${worst.label} landing pages to match top-channel CVR.`,
          expectedMonthlyImpact: Math.round(m.revenue30d * 0.04),
          confidenceScore: 0.78,
          focusArea: "channel",
          dataTier: ga4.funnelEvents?.verified ? "verified" : "estimated",
        });
      }
    }
  }

  if (ga4?.devices?.length) {
    const mobile = ga4.devices.find((d) => d.device === "mobile");
    const desktop = ga4.devices.find((d) => d.device === "desktop");
    if (mobile && desktop && mobile.sessions > desktop.sessions * 0.8) {
      const mobileRps = mobile.sessions > 0 ? mobile.revenue / mobile.sessions : 0;
      const desktopRps = desktop.sessions > 0 ? desktop.revenue / desktop.sessions : 0;
      if (desktopRps > 0 && mobileRps < desktopRps * 0.65) {
        actions.push({
          id: "mobile-checkout",
          priority: "critical",
          title: "Close the mobile conversion gap",
          description: `Mobile earns $${mobileRps.toFixed(2)}/session vs $${desktopRps.toFixed(2)} on desktop.`,
          recommendation: "Simplify mobile checkout, enlarge tap targets, and enable wallet pay.",
          expectedMonthlyImpact: Math.round((desktopRps - mobileRps) * mobile.sessions * 0.15),
          confidenceScore: 0.81,
          focusArea: "mobile",
          dataTier: "verified",
        });
      }
    }
  }

  if (ga4?.landingPages?.length) {
    const siteRps =
      ga4.sessions30d > 0 ? m.revenue30d / ga4.sessions30d : 0;
    const weak = ga4.landingPages
      .filter((p) => p.sessions >= 1500 && siteRps > 0 && p.revenue / p.sessions < siteRps * 0.5)
      .sort((a, b) => b.sessions - a.sessions)[0];
    if (weak) {
      actions.push({
        id: `landing-${weak.path}`,
        priority: "high",
        title: `Improve landing page: ${weak.path}`,
        description: `${weak.sessions.toLocaleString()} sessions with below-average revenue per session.`,
        recommendation: "Align hero offer with ad promise, speed up LCP, and surface social proof above the fold.",
        expectedMonthlyImpact: Math.round(weak.sessions * siteRps * 0.1),
        confidenceScore: 0.74,
        focusArea: "traffic",
        dataTier: "verified",
      });
    }
  }

  if (tier === "commerce_only" && attribution?.channels.length) {
    const withRoas = attribution.channels.filter(
      (c) => c.adSpend > 0 && c.attributedOrders > 0 && c.roas != null,
    );
    const lowRoas = withRoas
      .filter((c) => (c.roas ?? 0) < 1.2)
      .sort((a, b) => b.adSpend - a.adSpend);
    if (lowRoas[0]) {
      const ch = lowRoas[0];
      actions.push({
        id: `channel-roas-${ch.channelId}`,
        priority: "high",
        title: `Fix ${CHANNEL_LABELS[ch.channelId] ?? ch.channelLabel} efficiency`,
        description: `ROAS ${(ch.roas ?? 0).toFixed(2)} — spend is not converting profitably.`,
        recommendation: "Pause worst creatives, tighten audiences, or send traffic to higher-converting collections.",
        expectedMonthlyImpact: Math.round(ch.adSpend * 0.2),
        confidenceScore: 0.7,
        focusArea: "channel",
        dataTier: "estimated",
      });
    }
  }

  if (m.aov30d > 0 && m.orders30d > 0 && actions.length < 3) {
    actions.push({
      id: "aov-bundles",
      priority: "medium",
      title: "Lift AOV with post-add bundles",
      description: `Current AOV $${Math.round(m.aov30d)} — test complementary product bundles at cart.`,
      recommendation: "Add one-click upsell for best-selling accessory on top 3 SKUs.",
      expectedMonthlyImpact: Math.round(m.revenue30d * 0.06),
      confidenceScore: 0.65,
      focusArea: "aov",
      dataTier: tier === "step_level" ? "verified" : "estimated",
    });
  }

  const priorityRank = { critical: 0, high: 1, medium: 2 };
  return actions
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 6);
}

function buildAiInsights(
  steps: FunnelStepView[],
  snapshot: StoreSnapshot,
  tier: FunnelDataTier,
  actions: FunnelOptimizationAction[],
): FunnelAiInsight[] {
  const insights: FunnelAiInsight[] = [];

  if (tier === "step_level" && steps.length >= 5) {
    const sessions = steps[0]!;
    const atc = steps[2]!;
    const checkout = steps[3]!;
    const purchase = steps[4]!;

    const preAtcDrop =
      sessions.users > 0 ? Math.round(((sessions.users - atc.users) / sessions.users) * 100) : 0;
    if (preAtcDrop > 0) {
      insights.push({
        id: "pre-atc",
        text: `${preAtcDrop}% of visitors abandon before adding products to cart.`,
        tone: "warning",
      });
    }

    const checkoutLoss = checkout.users - purchase.users;
    if (checkoutLoss > 0 && checkout.users > 0) {
      const lossPct = Math.round((checkoutLoss / checkout.users) * 100);
      if (lossPct >= 20) {
        insights.push({
          id: "checkout-loss",
          text: `Most revenue is lost between Checkout and Payment — ${lossPct}% drop-off at final step.`,
          tone: "warning",
        });
      }
    }
  }

  if (tier === "session_level" && steps[0]) {
    insights.push({
      id: "session-cvr",
      text: `${steps[0].conversionPct.toFixed(2)}% of sessions convert to orders — optimize landing experience and checkout before scaling spend.`,
      tone: steps[0].conversionPct < 2 ? "warning" : "neutral",
    });
  }

  for (const action of actions.slice(0, 2)) {
    insights.push({
      id: `action-${action.id}`,
      text: action.description,
      tone: action.priority === "critical" ? "warning" : action.priority === "high" ? "neutral" : "positive",
    });
  }

  const ga4 = snapshot.ga4Snapshot;
  if (ga4?.sourceMedium?.length) {
    const google = ga4.sourceMedium.filter((r) => r.source.includes("google") && r.medium === "cpc");
    const meta = ga4.sourceMedium.filter(
      (r) =>
        (r.source.includes("facebook") || r.source.includes("instagram")) &&
        (r.medium === "paid" || r.medium === "cpc"),
    );
    const googleCvr =
      google.reduce((s, r) => s + r.sessions, 0) > 0
        ? google.reduce((s, r) => s + r.conversions, 0) / google.reduce((s, r) => s + r.sessions, 0)
        : 0;
    const metaCvr =
      meta.reduce((s, r) => s + r.sessions, 0) > 0
        ? meta.reduce((s, r) => s + r.conversions, 0) / meta.reduce((s, r) => s + r.sessions, 0)
        : 0;
    if (googleCvr > 0 && metaCvr > 0 && googleCvr > metaCvr * 1.2) {
      const pct = Math.round(((googleCvr - metaCvr) / metaCvr) * 100);
      insights.push({
        id: "channel-cvr",
        text: `Google Ads traffic converts ${pct}% better than Meta Ads.`,
        tone: "positive",
      });
    }
  }

  return insights.slice(0, 5);
}

export function buildFunnelPageView(input: {
  snapshot: StoreSnapshot;
  attribution?: AttributionDashboard | null;
  profitDashboard?: ProfitDashboard | null;
}): FunnelPageView {
  const tier = resolveDataTier(input.snapshot);
  const confidenceBlock = buildConfidence(tier, input.snapshot);

  const funnelSteps =
    tier === "step_level"
      ? buildFullFunnelSteps(input.snapshot)
      : tier === "session_level"
        ? buildSessionFunnelSteps(input.snapshot)
        : [];

  const optimizationActions = buildOptimizationActions(
    input.snapshot,
    input.attribution ?? null,
    funnelSteps,
    tier,
  );

  let bottleneck = buildBottleneck(funnelSteps, tier, input.snapshot);
  if (!bottleneck && optimizationActions[0]) {
    const top = optimizationActions[0];
    bottleneck = {
      title: top.title,
      description: top.description,
      impactLabel:
        top.expectedMonthlyImpact != null
          ? `Est. +$${top.expectedMonthlyImpact.toLocaleString()}/mo`
          : "High-impact conversion fix",
      focusStep: top.focusArea,
      confidence: top.dataTier,
    };
  }

  return {
    dataTier: tier,
    dataTierLabel: dataTierLabel(tier),
    confidence: confidenceBlock.confidence,
    confidenceScore: confidenceBlock.score,
    confidenceNotice: confidenceBlock.notice,
    availableMetrics: buildAvailableMetrics(input.snapshot, tier),
    trafficSources: buildTrafficSources(input.snapshot, input.attribution ?? null),
    funnelSteps,
    bottleneck,
    optimizationActions,
    aiInsights: buildAiInsights(
      funnelSteps,
      input.snapshot,
      tier,
      optimizationActions,
    ),
  };
}

/** @deprecated Use buildFunnelPageView — kept for analytics context compatibility */
export function buildFunnelAnalyticsLegacy(snapshot: StoreSnapshot) {
  const view = buildFunnelPageView({ snapshot });
  return {
    steps: view.funnelSteps.map((s) => ({
      id: s.id,
      label: s.label,
      count: s.users,
      conversionPct: s.conversionPct,
      dropPct: s.dropOffPct,
      lostUsers: s.users - (view.funnelSteps[view.funnelSteps.indexOf(s) + 1]?.users ?? s.users),
    })),
    aiExplanation: view.aiInsights[0]?.text ?? view.bottleneck?.description ?? "",
    requiresGa4: view.dataTier === "commerce_only",
  };
}
