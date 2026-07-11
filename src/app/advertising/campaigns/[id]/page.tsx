import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { buildCampaignDetailPageData } from "@/lib/services/advertising";

const CampaignDetailClient = nextDynamic(
  () =>
    import("@/components/advertising/CampaignDetailClient").then((m) => ({
      default: m.CampaignDetailClient,
    })),
  {
    loading: () => <div className="card skeleton-card analytics-loading-panel" aria-busy="true" />,
  },
);

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const data = await buildCampaignDetailPageData(id);

  if (!data) {
    notFound();
  }

  return (
    <AnalyticsPageShell
      title={data.campaign.campaign}
      description={`Campaign workspace — ${data.campaign.platformLabel}`}
      context="advertising"
      syncedAt={data.syncedAt}
      showDateRange={false}
    >
      <CampaignDetailClient {...data} />
    </AnalyticsPageShell>
  );
}
