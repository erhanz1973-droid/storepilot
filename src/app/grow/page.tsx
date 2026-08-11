import { GrowthCopilotPage } from "@/components/growth-copilot/GrowthCopilotPage";
import { FirstRunClientRedirect } from "@/components/first-run/FirstRunClientRedirect";
import { CommerceEmptyState } from "@/components/commerce/CommerceEmptyState";
import { shouldRedirectToFirstRun } from "@/lib/first-run/gate";
import { tryResolveActiveStoreId } from "@/lib/store/context";
import { allowDemoData } from "@/lib/env/runtime";
import { buildGrowthCopilotPageData } from "@/lib/services/growth-copilot";

export const dynamic = "force-dynamic";

export default async function GrowMyStorePage() {
  const gateToFirstRun = await shouldRedirectToFirstRun();
  if (gateToFirstRun) {
    return <FirstRunClientRedirect shouldRedirect />;
  }

  const storeId = await tryResolveActiveStoreId();
  if (!storeId && !allowDemoData()) {
    return (
      <>
        <div className="page-header">
          <h2>Grow My Store</h2>
          <p>Connect Shopify so StorePilot can tell you what to do next.</p>
        </div>
        <CommerceEmptyState entity="orders" />
      </>
    );
  }

  const view = await buildGrowthCopilotPageData();
  return <GrowthCopilotPage view={view} />;
}
