import { Ga4FunnelOnboardingPanel } from "@/components/connections/Ga4FunnelOnboardingPanel";
import type { Ga4FunnelOnboardingStep } from "@/lib/ga4/onboarding";

export function FunnelConnectionWizard({
  steps,
}: {
  steps: Ga4FunnelOnboardingStep[];
  setupTimeMinutes?: number;
}) {
  return <Ga4FunnelOnboardingPanel steps={steps} />;
}
