import type { IntegrationBoardItem, IntegrationBoardPayload } from "@/lib/connections/integration-board.types";
import { presentationShowsAsConnected } from "@/lib/connections/connection-state";
import type { ShopifyIntegrationDetail } from "@/lib/connections/integration-board.types";

export type OnboardingStepStatus = "complete" | "current" | "pending";

export type MerchantOnboardingStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  status: OnboardingStepStatus;
};

export type MerchantOnboardingState = {
  steps: MerchantOnboardingStep[];
  progressPct: number;
  complete: boolean;
  headline: string;
  subheadline: string;
};

function isConnected(item: IntegrationBoardItem | undefined): boolean {
  return item != null && presentationShowsAsConnected(item.status);
}

function shopifyLiveConnected(item: IntegrationBoardItem | undefined): boolean {
  if (!isConnected(item) || item.detail.type !== "shopify") return false;
  const detail = item.detail as ShopifyIntegrationDetail;
  return detail.connected && !detail.isDemo;
}

function hasAdPerformanceData(board: IntegrationBoardPayload): boolean {
  const meta = board.items.find((i) => i.id === "meta_ads");
  const google = board.items.find((i) => i.id === "google_ads");
  if (meta?.detail.type === "meta_ads" && meta.detail.connected && meta.detail.activeCampaigns > 0) {
    return true;
  }
  if (
    google?.detail.type === "google_ads" &&
    google.detail.connected &&
    google.detail.enabledCampaigns > 0
  ) {
    return true;
  }
  return false;
}

export function buildMerchantOnboarding(board: IntegrationBoardPayload): MerchantOnboardingState {
  const shopify = board.items.find((i) => i.id === "shopify");
  const meta = board.items.find((i) => i.id === "meta_ads");
  const google = board.items.find((i) => i.id === "google_ads");

  const shopifyDone = shopifyLiveConnected(shopify);
  const metaDone = isConnected(meta);
  const googleDone = isConnected(google);
  const adsConnected = metaDone || googleDone;
  const analysisReady = shopifyDone && adsConnected && hasAdPerformanceData(board);

  const rawSteps: Omit<MerchantOnboardingStep, "status">[] = [
    {
      id: "shopify",
      label: "Connect Shopify",
      description: "Sync products, orders, and costs so profit math uses your real catalog.",
      href: "/connections?tab=commerce",
    },
    {
      id: "meta",
      label: "Connect Meta Ads",
      description: "Import campaign spend and performance from Facebook and Instagram.",
      href: "/connections?tab=advertising",
    },
    {
      id: "google",
      label: "Connect Google Ads",
      description: "Import Search and Shopping campaigns for channel comparison.",
      href: "/connections?tab=advertising",
    },
    {
      id: "analysis",
      label: "Review your first analysis",
      description: "Open Advertising to see recommendations grounded in synced store data.",
      href: "/advertising",
    },
    {
      id: "executive",
      label: "Open Executive Dashboard",
      description: "Your daily briefing — only real metrics, no demo placeholders.",
      href: "/analytics/executive",
    },
  ];

  const completions = [
    shopifyDone,
    metaDone,
    googleDone,
    analysisReady,
    analysisReady,
  ];

  let foundCurrent = false;
  const steps: MerchantOnboardingStep[] = rawSteps.map((step, index) => {
    if (completions[index]) {
      return { ...step, status: "complete" };
    }
    if (!foundCurrent) {
      foundCurrent = true;
      return { ...step, status: "current" };
    }
    return { ...step, status: "pending" };
  });

  const completedCount = completions.filter(Boolean).length;
  const progressPct = Math.round((completedCount / rawSteps.length) * 100);
  const complete = completedCount === rawSteps.length;

  const headline = complete
    ? "You're set up for trustworthy recommendations"
    : shopifyDone
      ? "Connect ad platforms to unlock profit-aware recommendations"
      : "Connect your store to get started";

  const subheadline = complete
    ? "All onboarding steps complete. Recommendations use live synced data only."
    : "Complete these steps in order — we explain what's missing instead of showing demo data.";

  return { steps, progressPct, complete, headline, subheadline };
}
