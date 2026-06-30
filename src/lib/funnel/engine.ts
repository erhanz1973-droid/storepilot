import type { AttributionDashboard } from "@/lib/attribution/models";
import { CHANNEL_LABELS } from "@/lib/attribution/models";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import {
  FUNNEL_PREVIEW_STEPS,
  FUNNEL_UNLOCK_CAPABILITIES,
  type FunnelAiInsight,
  type FunnelAvailableMetric,
  type FunnelConfidence,
  type FunnelPageView,
  type FunnelStepView,
  type FunnelTrafficSource,
  type FunnelWizardStep,
  type Ga4ConnectionStatus,
} from "./types";

const PREVIEW_LABELS = [...FUNNEL_PREVIEW_STEPS];

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

function resolveGa4Status(snapshot: StoreSnapshot): {
  status: Ga4ConnectionStatus;
  label: string;
  notice: string;
} {
  const ga4 = snapshot.ga4Snapshot;
  if (!ga4?.sessions30d) {
    return {
      status: "unavailable",
      label: "Not Connected",
      notice: "Precise funnel analysis requires GA4 event tracking.",
    };
  }
  if (hasVerifiedFunnelEvents(snapshot)) {
    return {
      status: "connected",
      label: "Connected",
      notice: "GA4 ecommerce events are synced and verified.",
    };
  }
  return {
    status: "estimated",
    label: "Estimated",
    notice: "GA4 is connected but funnel events are not fully verified yet.",
  };
}

function buildAvailableMetrics(snapshot: StoreSnapshot): FunnelAvailableMetric[] {
  const m = snapshot.storeMetrics;
  const ga4 = snapshot.ga4Snapshot;
  const hasGa4 = Boolean(ga4?.sessions30d);

  const cvr =
    hasGa4 && ga4!.sessions30d > 0
      ? (m.orders30d / ga4!.sessions30d) * 100
      : m.conversionRate30d > 0
        ? m.conversionRate30d
        : null;

  const metrics: FunnelAvailableMetric[] = [
    metric(
      "orders",
      "Orders",
      m.orders30d.toLocaleString(),
      "verified",
      "From Shopify",
    ),
    metric(
      "revenue",
      "Revenue",
      `$${m.revenue30d.toLocaleString()}`,
      "verified",
      "From Shopify",
    ),
    metric(
      "aov",
      "Average Order Value",
      m.orders30d > 0 ? `$${Math.round(m.aov30d)}` : "—",
      "verified",
      "Revenue ÷ orders",
    ),
  ];

  if (cvr != null) {
    metrics.splice(1, 0, metric(
      "cvr",
      "Conversion Rate",
      `${cvr.toFixed(1)}%`,
      hasGa4 ? "verified" : "estimated",
      hasGa4 ? "Orders ÷ GA4 sessions" : "Estimated from store benchmarks",
    ));
  } else {
    metrics.splice(1, 0, metric(
      "cvr",
      "Conversion Rate",
      "—",
      "unavailable",
      "Connect GA4 for session-based conversion rate",
    ));
  }

  if (hasGa4) {
    metrics.unshift(metric(
      "sessions",
      "Sessions",
      ga4!.sessions30d.toLocaleString(),
      "verified",
      "From GA4",
    ));
  }

  return metrics;
}

function buildTrafficSources(
  snapshot: StoreSnapshot,
  attribution: AttributionDashboard | null,
): FunnelTrafficSource[] {
  const ga4 = snapshot.ga4Snapshot;
  if (ga4?.sourceMedium?.length) {
    const totals = new Map<string, number>();
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
      totals.set(label, (totals.get(label) ?? 0) + row.sessions);
    }
    const total = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
      .map(([label, sessions]) => ({
        label,
        sharePct: total > 0 ? Math.round((sessions / total) * 1000) / 10 : 0,
        status: "verified" as FunnelConfidence,
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
      }))
      .sort((a, b) => b.sharePct - a.sharePct)
      .slice(0, 6);
  }

  return [];
}

function buildWizardSteps(snapshot: StoreSnapshot, mode: FunnelPageView["mode"]): FunnelWizardStep[] {
  const ga4 = Boolean(snapshot.ga4Snapshot?.sessions30d);
  const eventsVerified = hasVerifiedFunnelEvents(snapshot);
  return [
    {
      step: 1,
      label: "Connect GA4",
      description: "Link your Google Analytics 4 property",
      complete: ga4,
    },
    {
      step: 2,
      label: "Verify Events",
      description: "Confirm view_item, add_to_cart, begin_checkout, and purchase events",
      complete: eventsVerified,
    },
    {
      step: 3,
      label: "Sync Historical Data",
      description: "Import at least 30 days of funnel event history",
      complete: eventsVerified,
    },
    {
      step: 4,
      label: "Generate Funnel",
      description: "StorePilot builds your conversion funnel with AI insights",
      complete: mode === "full",
    },
  ];
}

function buildConfidence(
  ga4Status: Ga4ConnectionStatus,
  snapshot: StoreSnapshot,
): { confidence: FunnelConfidence; score: number; notice: string } {
  if (ga4Status === "unavailable") {
    return {
      confidence: "unavailable",
      score: 0,
      notice: "Funnel analysis requires GA4 event tracking.",
    };
  }
  if (ga4Status === "estimated") {
    return {
      confidence: "estimated",
      score: 45,
      notice: "Sessions are synced but funnel events are not yet verified.",
    };
  }
  const events = snapshot.ga4Snapshot!.funnelEvents!;
  const ordersMatch =
    Math.abs(events.purchases30d - snapshot.storeMetrics.orders30d) /
      Math.max(snapshot.storeMetrics.orders30d, 1) <
    0.05;
  return {
    confidence: ordersMatch ? "verified" : "estimated",
    score: ordersMatch ? 92 : 72,
    notice: ordersMatch
      ? "Funnel steps verified against GA4 events and Shopify orders."
      : "Funnel events synced — purchase counts differ slightly from Shopify.",
  };
}

function buildFullFunnelSteps(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
): FunnelStepView[] {
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

function buildAiInsights(
  steps: FunnelStepView[],
  snapshot: StoreSnapshot,
  mode: FunnelPageView["mode"],
): FunnelAiInsight[] {
  if (mode !== "full" || steps.length < 5) return [];

  const sessions = steps[0]!;
  const views = steps[1]!;
  const atc = steps[2]!;
  const checkout = steps[3]!;
  const purchase = steps[4]!;

  const insights: FunnelAiInsight[] = [];

  const preAtcDrop = sessions.users > 0
    ? Math.round(((sessions.users - atc.users) / sessions.users) * 100)
    : 0;
  if (preAtcDrop > 0) {
    insights.push({
      id: "pre-atc",
      text: `${preAtcDrop}% of visitors abandon before adding products to cart.`,
      tone: "warning",
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

  if (ga4?.devices?.length) {
    const mobile = ga4.devices.find((d) => d.device === "mobile");
    const desktop = ga4.devices.find((d) => d.device === "desktop");
    if (mobile && desktop && mobile.sessions > desktop.sessions) {
      const mobileCvr = mobile.revenue / mobile.sessions;
      const desktopCvr = desktop.revenue / desktop.sessions;
      if (desktopCvr > mobileCvr * 1.15) {
        insights.push({
          id: "mobile-checkout",
          text: "Mobile checkout abandonment is significantly higher than desktop.",
          tone: "warning",
        });
      }
    }
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

  if (views.dropOffPct > atc.dropOffPct && views.dropOffPct > 30) {
    insights.push({
      id: "product-pages",
      text: `${views.dropOffPct.toFixed(0)}% of product viewers leave without adding to cart — review product page content.`,
      tone: "neutral",
    });
  }

  return insights;
}

export function buildFunnelPageView(input: {
  snapshot: StoreSnapshot;
  attribution?: AttributionDashboard | null;
  profitDashboard?: ProfitDashboard | null;
}): FunnelPageView {
  const ga4Resolved = resolveGa4Status(input.snapshot);
  const hasFullFunnel = ga4Resolved.status === "connected" && hasVerifiedFunnelEvents(input.snapshot);
  const mode: FunnelPageView["mode"] = hasFullFunnel ? "full" : "readiness";
  const confidenceBlock = buildConfidence(ga4Resolved.status, input.snapshot);

  const funnelSteps = hasFullFunnel
    ? buildFullFunnelSteps(input.snapshot, input.profitDashboard ?? null)
    : [];

  return {
    mode,
    ga4Status: ga4Resolved.status,
    ga4StatusLabel: ga4Resolved.label,
    ga4StatusNotice: ga4Resolved.notice,
    confidence: confidenceBlock.confidence,
    confidenceScore: confidenceBlock.score,
    confidenceNotice: confidenceBlock.notice,
    availableMetrics: buildAvailableMetrics(input.snapshot),
    trafficSources: buildTrafficSources(input.snapshot, input.attribution ?? null),
    previewStepLabels: PREVIEW_LABELS,
    limitationMessage:
      "We cannot determine where visitors abandon the purchase journey until GA4 events are available.",
    unlockCapabilities: [...FUNNEL_UNLOCK_CAPABILITIES],
    wizardSteps: buildWizardSteps(input.snapshot, mode),
    setupTimeMinutes: 5,
    funnelSteps,
    aiInsights: buildAiInsights(funnelSteps, input.snapshot, mode),
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
    aiExplanation: view.aiInsights[0]?.text ?? view.limitationMessage,
    requiresGa4: view.ga4Status === "unavailable",
  };
}
