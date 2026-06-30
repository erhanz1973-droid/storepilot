import type { StoreSnapshot } from "@/lib/connectors/types";
import type { MetaCampaign } from "@/lib/connectors/types";
import { buildBusinessFirstInsight } from "@/lib/metrics/hierarchy";
import { createCommerceOpportunity } from "./opportunity-schema";
import type { CommerceOpportunity } from "./opportunity-schema";

const ROAS_TARGET = 1.5;

function cpm(campaign: MetaCampaign): number {
  if (campaign.impressions7d <= 0) return 0;
  return Math.round((campaign.spend7d / campaign.impressions7d) * 1000 * 100) / 100;
}

function isRetargeting(name: string): boolean {
  return /retarget|remarket|warm|cart|visitor|existing/i.test(name);
}

function isProspecting(name: string): boolean {
  return /prospect|cold|broad|lookalike|lal|acquisition|new/i.test(name);
}

function isLearningLimited(campaign: MetaCampaign): boolean {
  return /learning/i.test(campaign.name) || campaign.effectiveStatus === "PAUSED";
}

function analyzeMetaCampaign(
  campaign: MetaCampaign,
  accountAvg: { cpa: number; ctr: number; roas: number; cpm: number },
): CommerceOpportunity[] {
  const results: CommerceOpportunity[] = [];
  const campaignCpm = cpm(campaign);
  const purchases = campaign.revenue7d > 0 ? Math.max(1, Math.round(campaign.revenue7d / 80)) : 0;
  const cpa = purchases > 0 ? campaign.spend7d / purchases : campaign.spend7d;

  if (campaign.frequency7d > 3.5 && campaign.ctr7d < accountAvg.ctr * 0.75 && campaign.impressions7d > 5000) {
    const copy = buildBusinessFirstInsight({
      headline: `Advertising efficiency declining — ${campaign.name}`,
      why: "The same audience is seeing ads too often, weakening engagement and raising acquisition costs.",
      businessImpact: `ROAS ${campaign.roas7d.toFixed(2)} may continue to fall without creative refresh.`,
      action: "Launch 2–3 new creative variants and pause fatigued ad sets.",
      diagnostics: [
        { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2), trend: "down" },
        { label: "Frequency (7d)", value: campaign.frequency7d.toFixed(1), trend: "up" },
        { label: "CTR (7d)", value: `${campaign.ctr7d.toFixed(2)}%`, trend: "down" },
        { label: "Account avg CTR", value: `${accountAvg.ctr.toFixed(2)}%` },
      ],
    });
    results.push(
      createCommerceOpportunity({
        id: `meta-creative-fatigue-${campaign.id}`,
        source: "meta_ads",
        severity: "high",
        confidence: 88,
        title: copy.headline,
        description: copy.summary,
        recommendation: copy.action,
        category: "campaign_performance",
        supportingMetrics: copy.evidence,
        expectedImpact: { profitMonthly: Math.round(campaign.spend7d * 0.2 * 4.33), label: "" },
        futureAction: "reduce_budget",
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (campaign.frequency7d > 4 && campaign.spend7d > 100) {
    const copy = buildBusinessFirstInsight({
      headline: `Audience saturation limiting returns — ${campaign.name}`,
      why: "Repeated exposure to the same audience is reducing advertising efficiency before spend scales profitably.",
      businessImpact: `Weekly spend of $${campaign.spend7d.toLocaleString()} is at risk of generating diminishing returns.`,
      action: "Refresh creative, expand audiences, or cap frequency before ROAS erodes further.",
      diagnostics: [
        { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2) },
        { label: "Frequency (7d)", value: campaign.frequency7d.toFixed(1), trend: "up" },
        { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
      ],
    });
    results.push(
      createCommerceOpportunity({
        id: `meta-freq-${campaign.id}`,
        source: "meta_ads",
        severity: campaign.frequency7d > 6 ? "high" : "medium",
        confidence: 86,
        title: copy.headline,
        description: copy.summary,
        recommendation: copy.action,
        category: "campaign_performance",
        supportingMetrics: copy.evidence,
        expectedImpact: { profitMonthly: Math.round(campaign.spend7d * 0.25 * 4.33), label: "" },
        futureAction: "reduce_budget",
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (campaign.ctr7d < accountAvg.ctr * 0.7 && campaign.impressions7d > 5000) {
    const copy = buildBusinessFirstInsight({
      headline: `Customer acquisition efficiency weakened — ${campaign.name}`,
      why: "Ads are generating fewer clicks relative to spend, which typically precedes higher CPA and lower ROAS.",
      action: "Test new hooks and thumbnails; rotate top-performing creative variants.",
      diagnostics: [
        { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2) },
        { label: "CTR (7d)", value: `${campaign.ctr7d.toFixed(2)}%`, trend: "down" },
        { label: "Account avg CTR", value: `${accountAvg.ctr.toFixed(2)}%` },
        { label: "Impressions (7d)", value: campaign.impressions7d.toLocaleString() },
      ],
    });
    results.push(
      createCommerceOpportunity({
        id: `meta-ctr-decline-${campaign.id}`,
        source: "meta_ads",
        severity: "medium",
        confidence: 78,
        title: copy.headline,
        description: copy.summary,
        recommendation: copy.action,
        category: "campaign_performance",
        supportingMetrics: copy.evidence,
        expectedImpact: { revenueMonthly: Math.round(campaign.spend7d * 0.15 * 4.33), label: "" },
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (campaignCpm > accountAvg.cpm * 1.35 && campaign.impressions7d > 3000) {
    const cpmIncrease = accountAvg.cpm > 0 ? Math.round(((campaignCpm / accountAvg.cpm) - 1) * 100) : 0;
    const copy = buildBusinessFirstInsight({
      headline: `Advertising costs rose while efficiency declined — ${campaign.name}`,
      why: "Customer acquisition became more expensive, which pressures contribution margin unless conversion improves.",
      businessImpact:
        cpmIncrease > 0
          ? `Delivery costs increased approximately ${cpmIncrease}% vs account average.`
          : undefined,
      action: "Review audience overlap, bid strategy, and placement mix before scaling spend.",
      diagnostics: [
        { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2) },
        { label: "CPM (7d)", value: `$${campaignCpm.toFixed(2)}`, trend: "up" },
        { label: "Account avg CPM", value: `$${accountAvg.cpm.toFixed(2)}` },
        { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
      ],
    });
    results.push(
      createCommerceOpportunity({
        id: `meta-cpm-rise-${campaign.id}`,
        source: "meta_ads",
        severity: "medium",
        confidence: 75,
        title: copy.headline,
        description: copy.summary,
        recommendation: copy.action,
        category: "spend_efficiency",
        supportingMetrics: copy.evidence,
        expectedImpact: { profitMonthly: Math.round(campaign.spend7d * 0.12 * 4.33), label: "" },
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (campaign.spend7d > 200 && campaign.roas7d < 1) {
    results.push(
      createCommerceOpportunity({
        id: `meta-low-purchase-${campaign.id}`,
        source: "meta_ads",
        severity: "critical",
        confidence: 90,
        title: `High spend, low purchases — ${campaign.name}`,
        description: `Spent $${campaign.spend7d.toLocaleString()} with ROAS ${campaign.roas7d.toFixed(2)}.`,
        recommendation: "Pause or reduce budget and reallocate to winning ad sets.",
        category: "conversion",
        supportingMetrics: [
          { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
          { label: "7-day revenue", value: `$${campaign.revenue7d.toLocaleString()}` },
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2), trend: "down" },
        ],
        expectedImpact: { profitMonthly: Math.round(campaign.spend7d * 0.35 * 4.33), label: "" },
        futureAction: "pause_campaign",
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (campaign.roas7d >= 2.5 && campaign.frequency7d < 3 && campaign.spend7d > 150) {
    results.push(
      createCommerceOpportunity({
        id: `meta-winner-${campaign.id}`,
        source: "meta_ads",
        severity: "medium",
        confidence: 82,
        title: `Winning creative / campaign — ${campaign.name}`,
        description: `ROAS ${campaign.roas7d.toFixed(2)} with healthy frequency ${campaign.frequency7d.toFixed(1)}.`,
        recommendation: "Duplicate winning ad sets and scale budget 15–20%.",
        category: "campaign_performance",
        supportingMetrics: [
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2), trend: "up" },
          { label: "CTR (7d)", value: `${campaign.ctr7d.toFixed(2)}%` },
          { label: "Frequency (7d)", value: campaign.frequency7d.toFixed(1) },
        ],
        expectedImpact: { revenueMonthly: Math.round(campaign.spend7d * campaign.roas7d * 0.2 * 4.33), label: "" },
        futureAction: "scale_campaign",
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (cpa > accountAvg.cpa * 1.4 && campaign.spend7d > 100 && purchases > 0) {
    results.push(
      createCommerceOpportunity({
        id: `meta-cpa-high-${campaign.id}`,
        source: "meta_ads",
        severity: "high",
        confidence: 84,
        title: `CPA above account average — ${campaign.name}`,
        description: `CPA ~$${cpa.toFixed(0)} vs account average ~$${accountAvg.cpa.toFixed(0)}.`,
        recommendation: "Tighten targeting or pause underperforming ad sets.",
        category: "spend_efficiency",
        supportingMetrics: [
          { label: "Est. CPA (7d)", value: `$${cpa.toFixed(0)}`, trend: "up" },
          { label: "Account avg CPA", value: `$${accountAvg.cpa.toFixed(0)}` },
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2) },
        ],
        expectedImpact: { profitMonthly: Math.round((cpa - accountAvg.cpa) * purchases * 4.33), label: "" },
        futureAction: "reduce_budget",
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (isLearningLimited(campaign) && campaign.spend7d > 50) {
    results.push(
      createCommerceOpportunity({
        id: `meta-learning-${campaign.id}`,
        source: "meta_ads",
        severity: "low",
        confidence: 70,
        title: `Learning Limited — ${campaign.name}`,
        description: "Campaign may be stuck in learning due to insufficient conversion volume.",
        recommendation: "Consolidate ad sets, broaden audience, or increase budget to exit learning.",
        category: "campaign_performance",
        supportingMetrics: [
          { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
          { label: "Status", value: String(campaign.effectiveStatus) },
        ],
        expectedImpact: { revenueMonthly: Math.round(campaign.spend7d * 0.1 * 4.33), label: "" },
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (campaign.roas7d < ROAS_TARGET && campaign.spend7d > 100) {
    results.push(
      createCommerceOpportunity({
        id: `meta-roas-below-${campaign.id}`,
        source: "meta_ads",
        severity: campaign.roas7d < 1 ? "high" : "medium",
        confidence: 80,
        title: `ROAS below target — ${campaign.name}`,
        description: `ROAS ${campaign.roas7d.toFixed(2)} is under target ${ROAS_TARGET.toFixed(1)}.`,
        recommendation: "Review creative, audience, and landing page before increasing spend.",
        category: "roas",
        supportingMetrics: [
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2), trend: "down" },
          { label: "Target ROAS", value: ROAS_TARGET.toFixed(1) },
          { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
        ],
        expectedImpact: { profitMonthly: Math.round(campaign.spend7d * 0.2 * 4.33), label: "" },
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  return results;
}

function audienceType(name: string): string {
  if (/lal|lookalike/i.test(name)) return "Lookalike";
  if (/interest|affinity/i.test(name)) return "Interest";
  if (isRetargeting(name)) return "Retargeting";
  if (isProspecting(name)) return "Prospecting";
  if (/broad/i.test(name)) return "Broad";
  return "General";
}

function analyzeBestAudiences(campaigns: MetaCampaign[]): CommerceOpportunity[] {
  const byAudience = new Map<string, { spend: number; revenue: number; campaigns: string[] }>();

  for (const c of campaigns.filter((x) => x.spend7d > 50)) {
    const type = audienceType(c.name);
    const existing = byAudience.get(type) ?? { spend: 0, revenue: 0, campaigns: [] };
    existing.spend += c.spend7d;
    existing.revenue += c.revenue7d;
    existing.campaigns.push(c.name);
    byAudience.set(type, existing);
  }

  const ranked = [...byAudience.entries()]
    .map(([type, data]) => ({
      type,
      roas: data.spend > 0 ? data.revenue / data.spend : 0,
      spend: data.spend,
      campaigns: data.campaigns,
    }))
    .filter((a) => a.roas > 0)
    .sort((a, b) => b.roas - a.roas);

  if (ranked.length < 2) return [];

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  if (best.roas <= worst.roas * 1.3) return [];

  return [
    createCommerceOpportunity({
      id: "meta-best-audience",
      source: "meta_ads",
      severity: "medium",
      confidence: 81,
      title: `Best audience: ${best.type} (ROAS ${best.roas.toFixed(2)})`,
      description: `${best.type} audiences outperform ${worst.type} (${worst.roas.toFixed(2)} ROAS).`,
      recommendation: `Scale ${best.type.toLowerCase()} campaigns and reduce spend on ${worst.type.toLowerCase()} segments.`,
      category: "channel_comparison",
      supportingMetrics: [
        { label: `${best.type} ROAS`, value: best.roas.toFixed(2), trend: "up" },
        { label: `${worst.type} ROAS`, value: worst.roas.toFixed(2), trend: "down" },
        { label: `${best.type} spend (7d)`, value: `$${best.spend.toLocaleString()}` },
        { label: "Top campaign", value: best.campaigns[0] ?? "—" },
      ],
      expectedImpact: { profitMonthly: Math.round(best.spend * 0.15 * 4.33), label: "" },
      futureAction: "increase_budget",
      relatedEntityType: "audience",
      relatedEntityId: best.type.toLowerCase(),
    }),
  ];
}

function analyzeAudienceMix(campaigns: MetaCampaign[]): CommerceOpportunity[] {
  const prospecting = campaigns.filter((c) => isProspecting(c.name));
  const retargeting = campaigns.filter((c) => isRetargeting(c.name));
  if (prospecting.length === 0 || retargeting.length === 0) return [];

  const avg = (list: MetaCampaign[]) => {
    const spend = list.reduce((s, c) => s + c.spend7d, 0);
    const rev = list.reduce((s, c) => s + c.revenue7d, 0);
    return { roas: spend > 0 ? rev / spend : 0, spend };
  };

  const p = avg(prospecting);
  const r = avg(retargeting);
  if (p.roas <= 0 || r.roas <= 0) return [];

  const winner = p.roas > r.roas ? "Prospecting" : "Retargeting";
  const loser = winner === "Prospecting" ? "Retargeting" : "Prospecting";
  const winnerRoas = Math.max(p.roas, r.roas);
  const loserRoas = Math.min(p.roas, r.roas);

  if (winnerRoas <= loserRoas * 1.2) return [];

  return [
    createCommerceOpportunity({
      id: "meta-prospect-vs-retarget",
      source: "meta_ads",
      severity: "medium",
      confidence: 76,
      title: `${winner} outperforms ${loser}`,
      description: `${winner} ROAS ${winnerRoas.toFixed(2)} vs ${loser} ${loserRoas.toFixed(2)}.`,
      recommendation: `Shift incremental Meta budget toward ${winner.toLowerCase()} campaigns.`,
      category: "channel_comparison",
      supportingMetrics: [
        { label: "Prospecting ROAS", value: p.roas.toFixed(2) },
        { label: "Retargeting ROAS", value: r.roas.toFixed(2) },
        { label: "Prospecting spend", value: `$${p.spend.toLocaleString()}` },
        { label: "Retargeting spend", value: `$${r.spend.toLocaleString()}` },
      ],
      expectedImpact: { profitMonthly: Math.round((p.spend + r.spend) * 0.08 * 4.33), label: "" },
      relatedEntityType: "channel",
      relatedEntityId: "meta_audience_mix",
    }),
  ];
}

function accountAverages(campaigns: MetaCampaign[]) {
  const active = campaigns.filter((c) => c.spend7d > 0);
  const totalSpend = active.reduce((s, c) => s + c.spend7d, 0);
  const totalRev = active.reduce((s, c) => s + c.revenue7d, 0);
  const totalImpressions = active.reduce((s, c) => s + c.impressions7d, 0);
  const totalClicks = active.reduce((s, c) => s + (c.ctr7d / 100) * c.impressions7d, 0);
  const purchases = totalRev > 0 ? Math.max(1, Math.round(totalRev / 80)) : 1;

  return {
    roas: totalSpend > 0 ? totalRev / totalSpend : 0,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
    cpa: totalSpend / purchases,
  };
}

export function buildMetaAdsInsights(snapshot: StoreSnapshot): CommerceOpportunity[] {
  const campaigns = snapshot.campaigns.filter((c) => c.effectiveStatus === "ACTIVE" || c.spend7d > 0);
  if (campaigns.length === 0) return [];

  const accountAvg = accountAverages(campaigns);
  const results: CommerceOpportunity[] = [];

  for (const campaign of campaigns) {
    results.push(...analyzeMetaCampaign(campaign, accountAvg));
  }
  results.push(...analyzeAudienceMix(campaigns));
  results.push(...analyzeBestAudiences(campaigns));

  const totalSpend = campaigns.reduce((s, c) => s + c.spend7d, 0);
  const avgFreq =
    campaigns.reduce((s, c) => s + c.frequency7d, 0) / Math.max(campaigns.length, 1);
  if (totalSpend > 500 && avgFreq > 3.5) {
    const copy = buildBusinessFirstInsight({
      headline: "Meta advertising efficiency is deteriorating across campaigns",
      why: "High average frequency suggests audiences are saturating, which typically precedes rising acquisition costs and falling ROAS.",
      businessImpact: `$${totalSpend.toLocaleString()} in weekly spend may generate diminishing returns without audience expansion.`,
      action: "Expand audiences or cap frequency before scaling budget further.",
      diagnostics: [
        { label: "Total spend (7d)", value: `$${totalSpend.toLocaleString()}` },
        { label: "Avg frequency", value: avgFreq.toFixed(1), trend: "up" },
        { label: "Active campaigns", value: String(campaigns.length) },
      ],
    });
    results.push(
      createCommerceOpportunity({
        id: "meta-budget-saturation",
        source: "meta_ads",
        severity: "high",
        confidence: 79,
        title: copy.headline,
        description: copy.summary,
        recommendation: copy.action,
        category: "spend_efficiency",
        supportingMetrics: copy.evidence,
        expectedImpact: { profitMonthly: Math.round(totalSpend * 0.15 * 4.33), label: "" },
        futureAction: "reduce_budget",
      }),
    );
  }

  return results;
}
