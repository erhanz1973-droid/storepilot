/**
 * Layer 3 — Decision (non-financial)
 *
 * AI / recommendation engine outputs structured decisions.
 * No dollar formatting or UI numbers here.
 */

export type DecisionPriority = "critical" | "high" | "medium" | "low";

export type DecisionRisk = "low" | "medium" | "high";

export type DecisionGoal =
  | "increase_profit"
  | "reduce_waste"
  | "grow_revenue"
  | "clear_inventory"
  | "improve_efficiency";

export type AffectedEntity = {
  type: "campaign" | "product" | "collection" | "channel" | "customer_segment";
  id: string;
  name?: string;
};

/**
 * Structured financial inputs for impact — never parse UI strings when available.
 */
export type DecisionFinancialInputs = {
  /** Monthly avoided waste / cost savings (low bound for executive hero) */
  avoidedWasteMonthly?: number | null;
  /** Monthly avoided waste high bound */
  avoidedWasteHighMonthly?: number | null;
  /** Monthly advertising savings midpoint */
  advertisingSavingsMonthly?: number | null;
  /** Explicit net profit improvement when already modeled */
  netProfitMonthly?: number | null;
  /** Revenue recovery monthly */
  recoveredRevenueMonthly?: number | null;
  /** Margin improvement monthly */
  marginImprovementMonthly?: number | null;
  /** Current monthly ad spend for campaign context */
  currentAdSpendMonthly?: number | null;
  /** Expected ad spend after action */
  expectedAdSpendMonthly?: number | null;
  /** One-time implementation cost for payback */
  implementationCost?: number | null;
  /** Observation window in days */
  observationPeriodDays?: number | null;
  /** Campaigns affected */
  campaignCount?: number | null;
  /** Category for margin conversion */
  category?: string;
  /** Fallback label when structured inputs unavailable */
  expectedImpactLabel?: string;
  /** Model confidence 0–1 */
  confidenceScore?: number | null;
  /** ROAS from supporting metrics */
  expectedROAS?: string | null;
};

export type Decision = {
  id: string;
  reason: string;
  priority: DecisionPriority;
  confidenceScore: number;
  risk: DecisionRisk;
  goal: DecisionGoal;
  affectedEntities: AffectedEntity[];
  expectedAction: string;
  financialInputs: DecisionFinancialInputs;
  recommendationId?: string;
};
