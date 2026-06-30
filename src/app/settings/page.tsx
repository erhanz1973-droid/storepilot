import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { BusinessModelSelector } from "@/components/business-model/BusinessModelSelector";
import { MerchantModeSelector } from "@/components/decisions/MerchantModeSelector";
import { buildDashboard } from "@/lib/services/dashboard";
import { resolveMerchantMode } from "@/lib/store/merchant-mode";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [dashboard, merchantMode] = await Promise.all([
    buildDashboard(),
    resolveMerchantMode(),
  ]);

  return (
    <AnalyticsPageShell
      title="Settings"
      description="Business model, merchant mode, connections, and store preferences."
      context="executive"
      showDateRange={false}
    >
      <MerchantModeSelector initialMode={merchantMode} />

      {dashboard.businessProfile && (
        <div style={{ marginTop: 16 }}>
          <BusinessModelSelector profile={dashboard.businessProfile} />
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Connections</h3>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          Shopify, Meta Ads, Google Ads, GA4, and more.
        </p>
        <Link href="/connections" className="btn btn-primary">
          Manage Connections
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Integrations</h3>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          Klaviyo, TikTok, accounting, and warehouse systems.
        </p>
        <Link href="/integrations" className="btn btn-ghost">
          Integration Hub
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Feedback Center</h3>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          Report bugs, rate AI recommendations, and request features — all inside StorePilot.
        </p>
        <Link href="/feedback" className="btn btn-primary">
          Open Feedback Center
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Business Goals</h3>
        <p className="muted" style={{ margin: 0 }}>
          Goal-aware AI uses your primary business objective to rank recommendations.
          Configure via API: <code>POST /api/store/business-goals</code>
        </p>
      </div>
    </AnalyticsPageShell>
  );
}
