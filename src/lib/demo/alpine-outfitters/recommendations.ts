import type { AnalyzerOutput } from "@/lib/types";
import {
  ALPINE_BACKPACK,
  ALPINE_JACKET,
  ALPINE_POLES,
  ALPINE_SOCKS,
} from "./products";

/**
 * Curated App Store demo recommendations — deterministic copy with
 * confidence, estimated monthly impact, priority, and category.
 */
export const ALPINE_CURATED_RECOMMENDATIONS: AnalyzerOutput[] = [
  {
    id: "ao-rec-google-budget",
    category: "campaign_review",
    title: "Increase Google Ads budget by 15%",
    description:
      "Google Search and Shopping are delivering a 4.35 ROAS with headroom on branded and outdoor apparel queries. Increasing budget 15% is projected to capture additional high-intent traffic without diluting efficiency.",
    priority: "high",
    expectedImpact: "+$3,540 estimated monthly revenue",
    confidence: 0.94,
    financialImpact: {
      estimatedMonthlyRevenueIncrease: 3_540,
      estimatedMonthlyProfitIncrease: 980,
    },
    evidence: [
      { label: "Google ROAS (30d)", value: "4.35x" },
      { label: "Google spend (30d)", value: "$5,420" },
      { label: "Google revenue (30d)", value: "$23,600" },
      { label: "Recommended budget change", value: "+15%" },
    ],
    actions: [{ label: "Increase budget", type: "review" }],
    entityType: "campaign",
    entityId: "ao-g-outdoor-search",
  },
  {
    id: "ao-rec-pause-meta",
    category: "campaign_review",
    title: "Pause two underperforming Meta campaigns",
    description:
      "Spring Awareness — Broad Interest (0.4 ROAS) and Instagram Reels — Gear Tips Test (0.18 ROAS) are destroying margin. Pausing both frees ~$400/week to reallocate into Prospecting Lookalike and Cart Retargeting.",
    priority: "critical",
    expectedImpact: "+$1,820 estimated monthly profit recovered",
    confidence: 0.96,
    financialImpact: {
      estimatedMonthlyCostSavings: 1_720,
      estimatedMonthlyProfitIncrease: 1_820,
    },
    evidence: [
      { label: "Spring Awareness ROAS", value: "0.40x" },
      { label: "IG Reels Test ROAS", value: "0.18x" },
      { label: "Combined weekly spend", value: "$400" },
      { label: "Winning Meta ROAS", value: "4.4x–5.5x" },
    ],
    actions: [{ label: "Pause campaigns", type: "review" }],
    entityType: "campaign",
    entityId: "ao-meta-spring-awareness",
  },
  {
    id: "ao-rec-restock-jacket",
    category: "low_inventory",
    title: "Restock Alpine Waterproof Jacket within 7 days",
    description:
      "Alpine Waterproof Jacket has only 14 units on hand while selling ~2.4 units/day. At current velocity, stockout is likely inside a week — risking ~$3,200 in lost revenue.",
    priority: "critical",
    expectedImpact: "+$3,200 estimated monthly revenue protected",
    confidence: 0.97,
    financialImpact: {
      estimatedMonthlyRevenueIncrease: 3_200,
      estimatedMonthlyProfitIncrease: 1_280,
    },
    evidence: [
      { label: "Units on hand", value: "14" },
      { label: "30-day units sold", value: String(ALPINE_JACKET.unitsSold30d) },
      { label: "Days of cover", value: "~5.8" },
      { label: "30-day revenue", value: `$${ALPINE_JACKET.revenue30d.toLocaleString()}` },
    ],
    actions: [{ label: "Create PO", type: "review" }],
    entityType: "product",
    entityId: ALPINE_JACKET.id,
  },
  {
    id: "ao-rec-bundle-poles",
    category: "bundle_opportunity",
    title: "Bundle Trekking Poles with Hiking Backpack",
    description:
      "Summit Backpack 35L and Trekking Poles Pro frequently appear in the same sessions. A 10% bundle discount is projected to lift AOV and attach rate on trail-ready kits.",
    priority: "high",
    expectedImpact: "+$2,150 estimated monthly revenue",
    confidence: 0.91,
    financialImpact: {
      estimatedMonthlyRevenueIncrease: 2_150,
      estimatedMonthlyProfitIncrease: 740,
    },
    evidence: [
      { label: "Backpack 30d revenue", value: `$${ALPINE_BACKPACK.revenue30d.toLocaleString()}` },
      { label: "Poles 30d revenue", value: `$${ALPINE_POLES.revenue30d.toLocaleString()}` },
      { label: "Suggested discount", value: "10% bundle" },
      { label: "Attach-rate lift", value: "+18%" },
    ],
    actions: [{ label: "Create bundle", type: "review" }],
    entityType: "product",
    entityId: ALPINE_BACKPACK.id,
  },
  {
    id: "ao-rec-price-socks",
    category: "promotion_opportunity",
    title: "Increase price of Merino Socks by 5%",
    description:
      "Merino Hiking Socks convert strongly with high margin and low price elasticity signals. A 5% price increase ($22 → $23.10) is expected to add profit with negligible volume loss.",
    priority: "medium",
    expectedImpact: "+$620 estimated monthly profit",
    confidence: 0.89,
    financialImpact: {
      estimatedMonthlyRevenueIncrease: 205,
      estimatedMonthlyProfitIncrease: 620,
    },
    evidence: [
      { label: "Current price", value: `$${ALPINE_SOCKS.price}` },
      { label: "Suggested price", value: "$23.10" },
      { label: "Units sold (30d)", value: String(ALPINE_SOCKS.unitsSold30d) },
      { label: "Gross margin", value: "~73%" },
    ],
    actions: [{ label: "Update price", type: "review" }],
    entityType: "product",
    entityId: ALPINE_SOCKS.id,
  },
  {
    id: "ao-rec-reduce-inventory",
    category: "slow_selling",
    title: "Reduce inventory of slow-moving products",
    description:
      "Camping Lantern and Hiking Gaiters are overstocked relative to sell-through. A targeted markdown plus reduced replenishment frees ~$4,800 in working capital over 60 days.",
    priority: "medium",
    expectedImpact: "+$4,800 working capital recovered (60d)",
    confidence: 0.88,
    financialImpact: {
      estimatedMonthlyCostSavings: 2_400,
      estimatedMonthlyProfitIncrease: 410,
    },
    evidence: [
      { label: "Camping Lantern on hand", value: "186" },
      { label: "Hiking Gaiters on hand", value: "142" },
      { label: "Suggested action", value: "15% markdown + pause PO" },
      { label: "Cash unlock (60d)", value: "$4,800" },
    ],
    actions: [{ label: "Plan clearance", type: "review" }],
    entityType: "product",
    entityId: "gid://shopify/Product/ao-1006",
  },
];
