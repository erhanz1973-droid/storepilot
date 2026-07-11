import { MerchantOnboardingWizard } from "@/components/onboarding/MerchantOnboardingWizard";
import { buildIntegrationBoard } from "@/lib/connections/integration-board";
import { buildMerchantOnboarding } from "@/lib/onboarding/merchant-setup";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const board = await buildIntegrationBoard();
  const onboarding = buildMerchantOnboarding(board);

  return (
    <>
      <div className="page-header">
        <h2>Get started</h2>
        <p>
          Connect your store and ad accounts so your first AI recommendations are grounded in real
          data — not demo placeholders.
        </p>
      </div>
      <MerchantOnboardingWizard state={onboarding} />
    </>
  );
}
