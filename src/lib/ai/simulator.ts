import type { BusinessContext, SimulationResult } from "./types";

function parsePercent(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) / 100 : null;
}

function matchCampaign(context: BusinessContext, text: string) {
  const lower = text.toLowerCase();
  return context.campaigns.find(
    (c) =>
      lower.includes(c.name.toLowerCase()) ||
      (lower.includes("summer") && c.name.toLowerCase().includes("summer")) ||
      (lower.includes("spf") && c.name.toLowerCase().includes("spf")) ||
      (lower.includes("retarget") && c.name.toLowerCase().includes("retarget")),
  );
}

export function runSimulation(
  context: BusinessContext,
  question: string,
): SimulationResult | null {
  const lower = question.toLowerCase();

  const isInventorySim =
    lower.includes("inventory") &&
    (lower.includes("increase") || lower.includes("what if") || lower.includes("what happens"));

  if (isInventorySim) {
    const pct = parsePercent(question) ?? 0.2;
    const topLow = context.lowStockProducts[0];
    const product = context.topProducts[0];
    const target = topLow ?? product;
    if (!target) return null;

    const dailyVelocity =
      "unitsSold30d" in (product ?? {})
        ? (product as { unitsSold30d: number }).unitsSold30d / 30
        : 4;
    const currentInv = "inventory" in target ? (target as { inventory: number }).inventory : 8;
    const addedUnits = Math.round(currentInv * pct);
    const weeklyRevenue = Math.round(dailyVelocity * addedUnits * 0.7 * 89);

    return {
      scenario: `Increase inventory by ${Math.round(pct * 100)}%`,
      summary: `Adding ~${addedUnits} units to ${"title" in target ? target.title : "top SKU"} could prevent stockouts and capture demand you're currently missing.`,
      estimatedImpact: `+$${weeklyRevenue.toLocaleString()}/week in recoverable revenue (assuming 70% sell-through of added units)`,
      metrics: [
        { label: "Current inventory", value: String(currentInv) },
        { label: "Added units", value: String(addedUnits) },
        { label: "Daily velocity", value: dailyVelocity.toFixed(1) },
        { label: "Store AOV", value: `$${context.storeMetrics.aov30d}` },
      ],
      confidence: 0.72,
    };
  }

  const isCampaignStop =
    (lower.includes("stop") || lower.includes("pause") || lower.includes("what if")) &&
    (lower.includes("campaign") || lower.includes("ads") || lower.includes("meta"));

  if (isCampaignStop) {
    if (!context.hasActiveAdsConnector) {
      return {
        scenario: "Connect ad platform",
        summary:
          "Campaign simulations require a connected ad platform (Meta Ads, Google Ads, or TikTok Ads). Connect one to model spend, ROAS, and frequency changes.",
        estimatedImpact: "N/A until an ad connector is connected",
        metrics: [],
        confidence: 1,
      };
    }

    if (!context.hasActiveMetaCampaigns) {
      return {
        scenario: "No active campaigns",
        summary: "No active Meta campaigns found.",
        estimatedImpact: "N/A",
        metrics: [],
        confidence: 1,
      };
    }

    const campaign = matchCampaign(context, question) ?? context.campaigns.find((c) => c.roas7d < 1.2);
    if (!campaign) return null;

    const savedSpend = campaign.spend7d;
    const lostRevenue = campaign.revenue7d;
    const netWeekly = campaign.roas7d < 1 ? savedSpend - lostRevenue : -lostRevenue * 0.3;

    return {
      scenario: `Campaign review — ${campaign.name}`,
      summary:
        campaign.roas7d < 1
          ? `${campaign.name} is below break-even (ROAS ${campaign.roas7d.toFixed(2)}). Reviewing budget allocation rather than an abrupt stop could recover efficiency.`
          : `${campaign.name} has ROAS ${campaign.roas7d.toFixed(2)}. Reducing spend may lower revenue from retargeting conversions.`,
      estimatedImpact:
        netWeekly >= 0
          ? `Estimated +$${Math.round(netWeekly).toLocaleString()}/week in ad efficiency if spend is reallocated`
          : `Estimated -$${Math.round(Math.abs(netWeekly)).toLocaleString()}/week revenue risk if campaign is paused`,
      metrics: [
        { label: "7-day spend", value: `$${campaign.spend7d}` },
        { label: "7-day revenue", value: `$${campaign.revenue7d}` },
        { label: "ROAS", value: campaign.roas7d.toFixed(2), trend: "down" },
        { label: "Frequency", value: campaign.frequency7d.toFixed(1) },
      ],
      confidence: campaign.roas7d < 1 ? 0.85 : 0.68,
    };
  }

  return null;
}

export function isSimulationQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  return (
    lower.includes("what if") ||
    lower.includes("what happens") ||
    (lower.includes("increase") && lower.includes("inventory")) ||
    (lower.includes("stop") && lower.includes("campaign"))
  );
}
