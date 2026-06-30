import type { SimulationVerdict } from "@/lib/simulation-lab/types";

/** Client-safe audit types — no server imports. */

export type AuditCheckStatus = "pass" | "warn" | "fail";

export type SimulationAuditCheck = {
  id: string;
  label: string;
  status: AuditCheckStatus;
  detail: string;
};

export type ProductAdSalesAudit = {
  productId: string;
  productTitle: string;
  unitsSold30d: number;
  revenue30d: number;
  revenue7d: number;
  allocatedAdSpend7d: number;
  productRoas7d: number;
  revenueMatchesUnits: boolean;
  adsToSalesVerdict: AuditCheckStatus;
  detail: string;
};

export type CampaignSuccessAudit = {
  campaignId: string;
  campaignName: string;
  platform: "meta" | "google";
  spend7d: number;
  revenue7d: number;
  roas7d: number;
  ctr7d?: number;
  frequency7d?: number;
  successVerdict: AuditCheckStatus;
  detail: string;
};

export type ProductAdAuditResult = {
  products: ProductAdSalesAudit[];
  campaigns: CampaignSuccessAudit[];
  checks: SimulationAuditCheck[];
  attributedOrderRevenue: number;
  attributedOrderCount: number;
};

export type SimulationAuditReport = {
  storeId: string;
  slug: string;
  scenarioId: string;
  scenarioLabel: string;
  auditedAt: string;
  dataChecks: SimulationAuditCheck[];
  gate: {
    canGenerateRecommendations: boolean;
    overallMatchPercent: number | null;
    trustedProviderIds: string[];
    blockedProviderIds: string[];
  };
  adMetrics: {
    metaSpend7d: number;
    metaRevenue7d: number;
    metaRoas7d: number;
    googleSpend7d: number;
    googleRevenue7d: number;
    googleRoas7d: number;
    revenue30d: number;
    orders30d: number;
    campaignCount: number;
  };
  decisions: {
    verdict: SimulationVerdict;
    passCount: number;
    warnCount: number;
    failCount: number;
    decisionCount: number;
    matches: {
      expectedLabel: string;
      verdict: AuditCheckStatus;
      reason: string;
      actualSummary?: string;
    }[];
    forbiddenHits: string[];
    samples: { summary: string; why: string; recommendedAction: string }[];
  };
  validationSuite: {
    passed: number;
    failed: number;
    warned: number;
    readyForLaunch: boolean;
    blockers: string[];
  };
  productAdAudit: ProductAdAuditResult;
  overallVerdict: SimulationVerdict;
};
