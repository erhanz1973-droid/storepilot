import { META_GRAPH_VERSION } from "@/lib/meta/oauth";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import { pushMetaApiLog } from "./registry";

function parseMetaRequest(url: string): {
  method: string;
  endpoint: string;
  adAccountId: string;
  dateRange?: string;
} {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const versionIdx = parts.findIndex((p) => p === META_GRAPH_VERSION);
    const rest = versionIdx >= 0 ? parts.slice(versionIdx + 1) : parts;
    const adAccountId = rest[0]?.startsWith("act_") ? rest[0] : "unknown";
    const endpoint = rest.length > 0 ? `/${rest.join("/")}` : parsed.pathname;
    const dateRange =
      parsed.searchParams.get("date_preset") ??
      parsed.searchParams.get("time_range") ??
      (parsed.searchParams.get("time_increment") ? "daily" : undefined) ??
      undefined;
    return { method: "GET", endpoint, adAccountId, dateRange };
  } catch {
    return { method: "GET", endpoint: url, adAccountId: "unknown" };
  }
}

export function logMetaApiRequest(url: string): void {
  if (!isDevValidationEnabled()) return;
  const parsed = parseMetaRequest(url);
  pushMetaApiLog({
    adAccountId: parsed.adAccountId,
    method: parsed.method,
    endpoint: parsed.endpoint,
    dateRange: parsed.dateRange,
    url,
  });
}
