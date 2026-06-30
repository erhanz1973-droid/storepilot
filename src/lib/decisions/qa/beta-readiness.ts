import type { BetaReadinessItem } from "./types";
import type { DecisionEngineQaReport } from "./types";

export function buildBetaReadinessReport(
  qa: Pick<
    DecisionEngineQaReport,
    | "consistencyPassed"
    | "productionPassed"
    | "performance"
    | "scenarioResults"
    | "merchantReady"
    | "decisions"
  >,
  integrations: {
    validationReady: boolean;
    shopifyConnected: boolean;
    metaConnected: boolean;
    googleConnected: boolean;
  },
): BetaReadinessItem[] {
  const scenarioPass =
    qa.scenarioResults == null ||
    qa.scenarioResults.every((s) => s.passed);

  const merchantRatio =
    qa.decisions.length > 0
      ? qa.merchantReady.length / qa.decisions.length
      : 0;

  return [
    {
      component: "Validation Framework",
      status: integrations.validationReady ? "ready" : "needs_testing",
      notes: integrations.validationReady
        ? "Gate and audit pipeline active"
        : "Connect providers and run validation",
    },
    {
      component: "Decision Engine",
      status:
        qa.consistencyPassed && qa.productionPassed && scenarioPass
          ? "ready"
          : qa.consistencyPassed
            ? "needs_testing"
            : "incomplete",
      notes: `${qa.merchantReady.length}/${qa.decisions.length} merchant-ready · ${qa.performance.totalMs}ms`,
    },
    {
      component: "Shopify Integration",
      status: integrations.shopifyConnected ? "ready" : "needs_testing",
      notes: integrations.shopifyConnected ? "Connected" : "Demo or disconnected",
    },
    {
      component: "Meta Integration",
      status: integrations.metaConnected ? "ready" : "needs_testing",
      notes: integrations.metaConnected ? "Connected" : "Not connected",
    },
    {
      component: "Google Ads Integration",
      status: integrations.googleConnected ? "needs_testing" : "incomplete",
      notes: integrations.googleConnected
        ? "Connected — validation partial"
        : "Not connected",
    },
    {
      component: "Autopilot",
      status: "needs_testing",
      notes: "Rules engine present; not validated in QA pass",
    },
    {
      component: "Outcome Tracking",
      status: merchantRatio > 0.5 ? "ready" : "needs_testing",
      notes: "Observation scheduler wired on approve",
    },
  ];
}
