import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buildAlphaDashboardMetrics } from "@/lib/analytics/alpha-metrics";

export const dynamic = "force-dynamic";

const ALPHA_COOKIE = "storepilot_alpha_dashboard";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 120) return `${sec}s`;
  return `${Math.round(sec / 60)} min`;
}

function formatRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${rate}%`;
}

export default async function AlphaAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const secret = process.env.STOREPILOT_INTERNAL_SECRET?.trim();
  const params = await searchParams;
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ALPHA_COOKIE)?.value;

  if (params.token?.trim() && secret) {
    redirect(`/api/internal/alpha/session?token=${encodeURIComponent(params.token.trim())}`);
  }

  if (!secret || cookieToken !== secret) {
    return (
      <main className="first-run-inner" style={{ margin: "40px auto" }}>
        <h1>Alpha analytics</h1>
        <p className="muted">
          Unauthorized. Open{" "}
          <code>/internal/alpha?token=$STOREPILOT_INTERNAL_SECRET</code> once to unlock a session
          cookie.
        </p>
      </main>
    );
  }

  const metrics = await buildAlphaDashboardMetrics();

  const rows: { label: string; value: string }[] = [
    { label: "Stores tracked", value: String(metrics.storesTracked) },
    { label: "Installations completed", value: String(metrics.installationCompleted) },
    { label: "Shopify connected", value: String(metrics.shopifyConnected) },
    { label: "Connection success rate", value: formatRate(metrics.connectionSuccessRate) },
    { label: "First-run opened", value: String(metrics.firstRunOpened) },
    { label: "First recommendation shown", value: String(metrics.firstRecommendationShown) },
    { label: "See Why clicked", value: String(metrics.seeWhyClicked) },
    { label: "Recommendations approved", value: String(metrics.recommendationApproved) },
    { label: "Recommendations rejected", value: String(metrics.recommendationRejected) },
    { label: "Approval rate", value: formatRate(metrics.approvalRate) },
    { label: "Rejection rate", value: formatRate(metrics.rejectionRate) },
    {
      label: "Avg time to first recommendation",
      value: formatDuration(metrics.avgTimeToFirstRecommendationMs),
    },
    {
      label: "Avg time to first approval",
      value: formatDuration(metrics.avgTimeToFirstApprovalMs),
    },
    { label: "Avg first-run session", value: formatDuration(metrics.avgSessionDurationMs) },
    { label: "Return visits (stores)", value: String(metrics.returnVisits) },
    {
      label: "Stores with zero recommendations",
      value: String(metrics.storesWithZeroRecommendations),
    },
    {
      label: "Stores with no completed sync/analysis",
      value: String(metrics.storesWithNoCompletedSync),
    },
  ];

  return (
    <main className="first-run-inner" style={{ margin: "32px auto 64px", width: "min(960px, 100%)" }}>
      <header>
        <p className="first-run-eyebrow">Internal · Alpha</p>
        <h1 style={{ margin: "6px 0" }}>Alpha analytics</h1>
        <p className="muted" style={{ margin: 0 }}>
          First-run funnel health · generated {new Date(metrics.generatedAt).toLocaleString()}
        </p>
      </header>
      <div className="alpha-metrics-grid">
        {rows.map((row) => (
          <div key={row.label} className="card alpha-metric-card">
            <p>{row.label}</p>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </main>
  );
}
