import nextDynamic from "next/dynamic";
import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import {
  buildExecutivePageData,
} from "@/lib/services/analytics";
import { resolveAdvertisingEntitlements } from "@/lib/billing/resolve-entitlements-light";
import { buildEmbeddedSafeExecutiveFallback } from "@/lib/services/embedded-executive-fallback";
import { resolveActiveStoreId } from "@/lib/store/context";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEMO_STORE_ID } from "@/lib/types";

const ExecutivePageClient = nextDynamic(
  () =>
    import("@/components/executive/ExecutivePageClient").then((m) => ({
      default: m.ExecutivePageClient,
    })),
  {
    loading: () => <div className="card skeleton-card analytics-loading-panel" aria-busy="true" />,
  },
);

export const dynamic = "force-dynamic";

export default async function ExecutiveAnalyticsPage() {
  const [activeStoreId, dataResult, entitlementsResult] = await Promise.all([
    resolveActiveStoreId(),
    buildExecutivePageData().catch(async (error) => {
      return buildEmbeddedSafeExecutiveFallback(error);
    }),
    resolveAdvertisingEntitlements().catch(() => ({
      entitlements: undefined as import("@/lib/billing/types").CampaignEntitlements | undefined,
    })),
  ]);

  const data = dataResult;
  const isDemo = activeStoreId === DEMO_STORE_ID || isSimulationStoreId(activeStoreId);
  const planUsage = entitlementsResult.entitlements;

  return (
    <AnalyticsPageShell
      title="Executive Dashboard"
      description="What should I focus on today? Your CEO briefing, daily playbook, and links to each executive module."
      context="executive"
      syncedAt={data.syncedAt}
      showDateRange={false}
      executiveAiStatus={data.aiBehavior.liveStatus}
    >
      <ExecutivePageClient view={data} isDemo={isDemo} planUsage={planUsage} />
    </AnalyticsPageShell>
  );
}
