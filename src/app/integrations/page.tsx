import { IntegrationConfidenceBanner } from "@/components/integrations/IntegrationConfidenceBanner";
import { IntegrationGrid } from "@/components/integrations/IntegrationGrid";
import { buildIntegrationsHub } from "@/lib/services/integrations";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const hub = await buildIntegrationsHub();

  return (
    <>
      <div className="page-header">
        <h2>Integrations</h2>
        <p>
          Connect business systems to replace estimates with live data. Last synced{" "}
          {new Date(hub.syncedAt).toLocaleString()}.
        </p>
      </div>

      <IntegrationConfidenceBanner confidence={hub.confidence} />

      {hub.operationalCosts && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Operational Costs (30d)</h3>
          <div className="stack">
            <div className="breakdown-row">
              <span>Shipping</span>
              <strong>${hub.operationalCosts.shippingCost30d.toLocaleString()}</strong>
            </div>
            <div className="breakdown-row">
              <span>Support</span>
              <strong>${hub.operationalCosts.supportCost30d.toLocaleString()}</strong>
            </div>
            <div className="breakdown-row">
              <span>Warehouse & packing</span>
              <strong>${hub.operationalCosts.warehouseCost30d.toLocaleString()}</strong>
            </div>
            {hub.operationalCosts.actualCogs30d != null && (
              <div className="breakdown-row">
                <span>Actual COGS (accounting)</span>
                <strong>${hub.operationalCosts.actualCogs30d.toLocaleString()}</strong>
              </div>
            )}
            <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
              Sources: {hub.operationalCosts.sources.join(", ")}
            </p>
          </div>
        </div>
      )}

      <IntegrationGrid integrations={hub.integrations} />

      <p className="muted" style={{ marginTop: 16, fontSize: "0.875rem" }}>
        Set credentials via environment variables for live sync. Demo stores use sample integration
        data when <code>INTEGRATIONS_DEMO</code> is enabled.{" "}
        <Link href="/connected-store">Manage Shopify & Meta connections</Link>
      </p>
    </>
  );
}
