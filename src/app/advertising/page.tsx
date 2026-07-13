import nextDynamic from "next/dynamic";
import Link from "next/link";
import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { buildIntegrationReadiness } from "@/lib/trust/integration-readiness";
import { buildAdvertisingPageData } from "@/lib/services/advertising";
import { AdvertisingIntegrationBanner } from "@/components/advertising/AdvertisingIntegrationBanner";

const AdvertisingWorkspaceClient = nextDynamic(
  () =>
    import("@/components/advertising/AdvertisingWorkspaceClient").then((m) => ({
      default: m.AdvertisingWorkspaceClient,
    })),
  {
    loading: () => <div className="card skeleton-card analytics-loading-panel" aria-busy="true" />,
  },
);

export const dynamic = "force-dynamic";

export default async function AdvertisingPage() {
  const data = await buildAdvertisingPageData();
  const hasData = data.campaigns.length > 0;
  const readiness = buildIntegrationReadiness({
    snapshot: data.snapshot,
    campaigns: data.enrichedCampaigns,
  });

  return (
    <AnalyticsPageShell
      title="Advertising"
      description="Your AI advertising manager — decisions, simulations, and expected impact across every connected platform."
      context="advertising"
      syncedAt={data.syncedAt}
    >
      <AdvertisingIntegrationBanner readiness={readiness} />
      {data.attributionUnavailable ? (
        <div className="card">
          <p style={{ margin: 0 }}>Attribution data is not available yet.</p>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Connect ad platforms and ensure orders sync so StorePilot can build journeys.{" "}
            <Link href="/connections">Open Connections</Link>
          </p>
        </div>
      ) : !hasData ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Connect ad platforms to unlock the Advertising workspace.{" "}
            <Link href="/connections">Open Connections</Link>
          </p>
        </div>
      ) : (
        <AdvertisingWorkspaceClient {...data} />
      )}
    </AnalyticsPageShell>
  );
}
