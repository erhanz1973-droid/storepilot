import { LandingPage } from "@/components/marketing/LandingPage";
import { isMarketingRequest } from "@/lib/marketing/site";
import { FirstRunClientRedirect } from "@/components/first-run/FirstRunClientRedirect";
import { CommerceEmptyState } from "@/components/commerce/CommerceEmptyState";
import { GrowthCopilotPage } from "@/components/growth-copilot/GrowthCopilotPage";
import { shouldRedirectToFirstRun } from "@/lib/first-run/gate";
import { tryResolveActiveStoreId } from "@/lib/store/context";
import { allowDemoData } from "@/lib/env/runtime";
import { shouldLandOnGrowthCopilot } from "@/lib/growth-copilot";
import {
  buildGrowthCopilotPageData,
  resolveHomeMerchantStage,
} from "@/lib/services/growth-copilot";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (await isMarketingRequest()) {
    return <LandingPage />;
  }

  const gateToFirstRun = await shouldRedirectToFirstRun();
  if (gateToFirstRun) {
    return <FirstRunClientRedirect shouldRedirect />;
  }

  const storeId = await tryResolveActiveStoreId();
  if (!storeId && !allowDemoData()) {
    return (
      <>
        <div className="page-header">
          <h2>Today</h2>
          <p>Connect Shopify to load your live store.</p>
        </div>
        <CommerceEmptyState entity="orders" />
      </>
    );
  }

  const stage = await resolveHomeMerchantStage();
  if (shouldLandOnGrowthCopilot(stage)) {
    const view = await buildGrowthCopilotPageData();
    return <GrowthCopilotPage view={view} />;
  }

  const ExecutivePage = (await import("./analytics/executive/page")).default;
  return <ExecutivePage />;
}
