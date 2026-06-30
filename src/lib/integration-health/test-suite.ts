import { runValidationSuite } from "@/lib/validation/runner";
import type { IntegrationHealthDashboard, IntegrationTestResult } from "./types";

export async function runIntegrationTestSuite(
  storeId: string,
  dashboard: IntegrationHealthDashboard,
): Promise<IntegrationTestResult[]> {
  const started = performance.now();
  const results: IntegrationTestResult[] = [];

  const push = (id: string, label: string, passed: boolean, detail?: string, t0?: number) => {
    results.push({
      id,
      label,
      passed,
      detail,
      durationMs: Math.round((t0 != null ? performance.now() - t0 : 0)),
    });
  };

  let t = performance.now();
  const shopify = dashboard.providers.find((p) => p.id === "shopify");
  push(
    "shopify-connection",
    "Shopify Connection",
    shopify?.connectionStatus === "connected" || shopify?.connectionStatus === "demo",
    shopify?.connectionStatus,
    t,
  );

  t = performance.now();
  const shopifyComplete =
    shopify?.entityChecks.every((e) => e.status !== "missing") ?? false;
  push("shopify-completeness", "Shopify Data Completeness", shopifyComplete, undefined, t);

  t = performance.now();
  const meta = dashboard.providers.find((p) => p.id === "meta_ads");
  push(
    "meta-ads",
    "Meta Ads",
    meta?.connectionStatus === "connected" && !meta.lastApiError,
    meta?.aiReady ? `AI ready ${meta.aiReadyPct}%` : meta?.lastApiError ?? "Not connected",
    t,
  );

  t = performance.now();
  const google = dashboard.providers.find((p) => p.id === "google_ads");
  push(
    "google-ads",
    "Google Ads",
    google?.connectionStatus === "connected",
    google?.lastApiError ?? undefined,
    t,
  );

  t = performance.now();
  const ga4 = dashboard.providers.find((p) => p.id === "ga4");
  push("ga4", "GA4", ga4?.connectionStatus === "connected", undefined, t);

  t = performance.now();
  const decisions = dashboard.moduleReadiness.find((m) => m.id === "decisions");
  push(
    "decision-engine",
    "Decision Engine",
    decisions?.status === "ready",
    decisions?.blockers[0],
    t,
  );

  for (const test of dashboard.aiCapabilityTests) {
    t = performance.now();
    push(`ai-${test.id}`, test.label.replace(/\?$/, ""), test.passed, test.detail, t);
  }

  t = performance.now();
  const validation = await runValidationSuite({ storeId, includeIntegrations: true });
  push(
    "validation-suite",
    "Platform Validation Suite",
    validation.goNoGo.readyForLaunch,
    `${validation.passed} passed · ${validation.failed} failed`,
    t,
  );

  void started;
  return results;
}
