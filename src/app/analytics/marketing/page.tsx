import nextDynamic from "next/dynamic";
import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { buildMarketingPageData } from "@/lib/services/analytics";
import Link from "next/link";

const MarketingManagerClient = nextDynamic(
  () =>
    import("@/components/analytics/MarketingManagerClient").then((m) => ({
      default: m.MarketingManagerClient,
    })),
  {
    loading: () => <div className="card skeleton-card analytics-loading-panel" aria-busy="true" />,
  },
);

export const dynamic = "force-dynamic";

export default async function MarketingAnalyticsPage() {
  const data = await buildMarketingPageData();
  const hasData = data.campaigns.length > 0;

  return (
    <AnalyticsPageShell
      title="Marketing"
      description="AI Marketing Manager — know what's making money, what's losing money, and what to do next."
      context="marketing"
      syncedAt={data.syncedAt}
    >
      {!hasData ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Connect ad platforms to unlock campaign profitability and AI recommendations.{" "}
            <Link href="/connections">Open Connections</Link>
          </p>
        </div>
      ) : (
        <MarketingManagerClient
          campaigns={data.campaigns}
          platforms={data.platforms}
          comparisons={data.comparisons}
          forecast={data.forecast}
          v2={data.v2}
        />
      )}
    </AnalyticsPageShell>
  );
}
