import type { ImplementationEffort, SupportingMetric } from "@/lib/types";

/** Client-safe types for what-if simulations (no server imports). */

export type SimulationType =
  | "increase_price"
  | "decrease_price"
  | "increase_meta_budget"
  | "increase_google_budget"
  | "apply_discount"
  | "pause_campaign"
  | "restock_inventory"
  | "create_bundle"
  | "add_homepage_feature";

export type ResultBasis = "prediction" | "measured_historical";

export type WhatIfSimulationResult = {
  id: string;
  simulationType: SimulationType;
  label: string;
  summary: string;
  basis: ResultBasis;
  basisNote: string;
  expectedMonthlyRevenue: number;
  expectedMonthlyProfit: number;
  confidence: number;
  risks: string[];
  implementationEffort: ImplementationEffort;
  metrics: SupportingMetric[];
  historicalSampleSize?: number;
  historicalRealizationPct?: number;
};

export const SIMULATION_LABELS: Record<SimulationType, string> = {
  increase_price: "Increase price",
  decrease_price: "Decrease price",
  increase_meta_budget: "Increase Meta budget",
  increase_google_budget: "Increase Google budget",
  apply_discount: "Apply discount",
  pause_campaign: "Pause campaign",
  restock_inventory: "Restock inventory",
  create_bundle: "Create bundle",
  add_homepage_feature: "Add homepage feature",
};
