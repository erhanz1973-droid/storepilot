import type { TrendDirection } from "./types";
import type { HealthTier } from "./types";

export function healthTierFromScore(score: number): HealthTier {
  if (score >= 90) return "excellent";
  if (score >= 75) return "healthy";
  if (score >= 60) return "needs_review";
  if (score >= 40) return "weak";
  return "critical";
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreRoas(roas: number, breakEvenRoas: number | null): number {
  const target = breakEvenRoas ?? 2.0;
  if (roas >= target * 1.5) return 100;
  if (roas >= target) return 75 + ((roas - target) / (target * 0.5)) * 25;
  if (roas >= target * 0.7) return 50 + ((roas - target * 0.7) / (target * 0.3)) * 25;
  if (roas >= 1) return 30 + ((roas - 1) / (target * 0.7 - 1)) * 20;
  return Math.max(0, roas * 30);
}

function scoreProfit(profit: number | null, spend: number): number {
  if (profit == null) return 50;
  if (profit > spend * 0.3) return 100;
  if (profit > 0) return 70 + Math.min(30, (profit / spend) * 100);
  if (profit === 0) return 45;
  return Math.max(0, 40 + (profit / spend) * 100);
}

function scoreCtr(ctr: number): number {
  if (ctr >= 3) return 100;
  if (ctr >= 2) return 75;
  if (ctr >= 1) return 55;
  if (ctr >= 0.5) return 35;
  return 20;
}

function scoreConversionRate(rate: number): number {
  if (rate >= 4) return 100;
  if (rate >= 2) return 75;
  if (rate >= 1) return 55;
  if (rate >= 0.5) return 35;
  return 20;
}

function scoreFrequency(frequency: number): number {
  if (frequency <= 1.5) return 100;
  if (frequency <= 2.5) return 75;
  if (frequency <= 3.5) return 50;
  if (frequency <= 5) return 30;
  return 15;
}

function scoreTrend(trend: TrendDirection): number {
  if (trend === "up") return 85;
  if (trend === "flat") return 60;
  return 35;
}

export function computeCampaignHealthScore(input: {
  roas: number;
  profit: number | null;
  spend: number;
  cpa: number;
  ctr: number;
  conversionRate: number;
  frequency: number;
  isLearningPhase: boolean;
  trend: TrendDirection;
  breakEvenRoas: number | null;
  creativeScore?: number;
}): number {
  const weights = {
    roas: 0.2,
    profit: 0.18,
    ctr: 0.1,
    conversion: 0.1,
    frequency: 0.1,
    trend: 0.12,
    cpa: 0.08,
    creative: 0.07,
    learning: 0.05,
  };

  const roasScore = scoreRoas(input.roas, input.breakEvenRoas);
  const profitScore = scoreProfit(input.profit, input.spend);
  const ctrScore = scoreCtr(input.ctr);
  const convScore = scoreConversionRate(input.conversionRate);
  const freqScore = scoreFrequency(input.frequency);
  const trendScore = scoreTrend(input.trend);
  const cpaScore =
    input.cpa > 0 && input.roas > 0
      ? clampScore(100 - Math.min(80, (input.cpa / (input.roas * 20)) * 40))
      : 50;
  const creativeScore = input.creativeScore ?? 60;
  const learningScore = input.isLearningPhase ? 55 : 80;

  const raw =
    roasScore * weights.roas +
    profitScore * weights.profit +
    ctrScore * weights.ctr +
    convScore * weights.conversion +
    freqScore * weights.frequency +
    trendScore * weights.trend +
    cpaScore * weights.cpa +
    creativeScore * weights.creative +
    learningScore * weights.learning;

  return clampScore(raw);
}

export function businessStatusFromScore(score: number): { label: string; emoji: string } {
  if (score >= 75) return { label: "Healthy", emoji: "🟢" };
  if (score >= 60) return { label: "Needs Attention", emoji: "🟡" };
  if (score >= 40) return { label: "At Risk", emoji: "🟠" };
  return { label: "Critical", emoji: "🔴" };
}

export function deriveTrend(roas: number, health: string): TrendDirection {
  if (health === "scaling" || roas >= 3) return "up";
  if (health === "losing_money" || roas < 0.9) return "down";
  return "flat";
}

export function computeCreativeScore(input: {
  ctr: number;
  roas: number | null;
  frequency: number;
  status: string;
}): number {
  let score = 50;
  if (input.roas != null) {
    if (input.roas >= 4) score += 30;
    else if (input.roas >= 2.5) score += 20;
    else if (input.roas >= 1.5) score += 10;
    else if (input.roas < 1) score -= 25;
  }
  if (input.ctr >= 2.5) score += 15;
  else if (input.ctr < 1) score -= 10;
  if (input.frequency > 3) score -= 15;
  if (input.status === "winning") score += 10;
  if (input.status === "fatigued" || input.status === "underperforming") score -= 20;
  return clampScore(score);
}
