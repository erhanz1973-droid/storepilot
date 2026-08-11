import { GrowthCopilotClient } from "@/components/growth-copilot/GrowthCopilotClient";
import type { GrowthCopilotView } from "@/lib/growth-copilot";

export function GrowthCopilotPage({ view }: { view: GrowthCopilotView }) {
  return (
    <div className="growth-copilot-page">
      <div className="page-header">
        <h2>Today</h2>
        <p>AI Store Manager — your next step, based on this store&apos;s data.</p>
      </div>
      <GrowthCopilotClient view={view} />
    </div>
  );
}
