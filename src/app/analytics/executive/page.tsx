import nextDynamic from "next/dynamic";
import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { buildExecutivePageData } from "@/lib/services/analytics";
import { getCachedActiveStoreId } from "@/lib/services/store-bundle";
import { hasLiveShopifyConnection } from "@/lib/store/context";

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
  const [data, storeId] = await Promise.all([
    buildExecutivePageData(),
    getCachedActiveStoreId(),
  ]);
  const isDemo = !(await hasLiveShopifyConnection(storeId));

  return (
    <AnalyticsPageShell
      title="Executive Dashboard"
      description="Am I making money? What is hurting my business? What should I do today?"
      context="executive"
      syncedAt={data.syncedAt}
      showDateRange={false}
      executiveAiStatus={data.aiBehavior.liveStatus}
    >
      <ExecutivePageClient view={data} isDemo={isDemo} />
    </AnalyticsPageShell>
  );
}
