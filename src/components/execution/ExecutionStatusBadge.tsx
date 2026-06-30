import type { ExecutionAvailability } from "@/lib/execution/types";
import {
  executionAvailabilityDescription,
  executionAvailabilityLabel,
} from "@/lib/execution/availability";
import { getExecutionMode } from "@/lib/execution/config";

const DOT: Record<ExecutionAvailability, string> = {
  one_click: "var(--low)",
  manual: "#d4a017",
  autopilot_rule: "var(--accent)",
};

export function ExecutionStatusBadge({
  availability,
  missingShopifyScopes,
}: {
  availability: ExecutionAvailability;
  missingShopifyScopes?: string[];
}) {
  const mode = getExecutionMode();
  const scopesMissing = (missingShopifyScopes?.length ?? 0) > 0;

  return (
    <div className="execution-status-badge">
      <span className="execution-status-dot" style={{ color: DOT[availability] }}>
        ●
      </span>
      <div>
        <strong>
          {scopesMissing
            ? "Reconnect Shopify to enable one-click execution"
            : executionAvailabilityLabel(availability)}
        </strong>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem", lineHeight: 1.4 }}>
          {scopesMissing
            ? `Grant ${missingShopifyScopes!.join(", ")} by reconnecting Shopify, then approve again.`
            : executionAvailabilityDescription(availability)}
          {availability === "one_click" && !scopesMissing && (
            <>
              {" "}
              Execution mode: <strong>{mode === "live" ? "Live" : "Dry Run"}</strong>.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
