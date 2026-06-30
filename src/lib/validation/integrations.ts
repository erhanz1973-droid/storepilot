import { getConnectorRegistry, runConnectorHealthChecks } from "@/lib/connectors/registry";
import { PHASE6_INTEGRATIONS } from "@/lib/integrations/types";
import { isIntegrationConfigured } from "@/lib/integrations/credentials";
import type { ValidationCheck } from "./types";

const INTEGRATION_IDS = [
  "shopify",
  "meta_ads",
  ...PHASE6_INTEGRATIONS.map((d) => d.id),
] as const;

export async function validateIntegrations(): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  try {
    const health = await runConnectorHealthChecks();
    for (const h of health) {
      checks.push({
        id: `integration-health-${h.id}`,
        suite: "integrations",
        name: `${h.label} health check`,
        status: h.status === "error" ? "fail" : "pass",
        actual: h.status,
        message:
          h.status === "error"
            ? `Health check failed for ${h.label}`
            : `${h.label} health: ${h.status}${h.lastSyncAt ? ` (synced ${h.lastSyncAt})` : ""}`,
      });
    }
  } catch (err) {
    checks.push({
      id: "integration-health-error",
      suite: "integrations",
      name: "Connector health checks",
      status: "fail",
      message: err instanceof Error ? err.message : "Health check threw",
    });
  }

  for (const def of PHASE6_INTEGRATIONS) {
    const configured = isIntegrationConfigured(def);
    checks.push({
      id: `integration-config-${def.id}`,
      suite: "integrations",
      name: `${def.label} credentials`,
      status: configured ? "pass" : "skip",
      message: configured
        ? `${def.label} credentials detected in environment`
        : `${def.label} not configured — skipped (expected in demo/pilot)`,
    });
  }

  const registry = await getConnectorRegistry();
  for (const id of INTEGRATION_IDS) {
    if (!(id in registry) && !PHASE6_INTEGRATIONS.some((d) => d.id === id)) continue;
    const plugin = registry[id as keyof typeof registry];
    if (!plugin) continue;
    try {
      await plugin.healthCheck();
      checks.push({
        id: `integration-plugin-${id}`,
        suite: "integrations",
        name: `${plugin.label} plugin`,
        status: "pass",
        message: `${plugin.label} plugin loads and responds`,
      });
    } catch (err) {
      checks.push({
        id: `integration-plugin-${id}`,
        suite: "integrations",
        name: `${plugin.label} plugin`,
        status: "fail",
        message: err instanceof Error ? err.message : "Plugin error",
      });
    }
  }

  return checks;
}
