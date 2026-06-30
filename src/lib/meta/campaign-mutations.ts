import type { MetaCampaign } from "@/lib/connectors/types";
import { META_GRAPH_VERSION } from "@/lib/meta/oauth";
import type { MetaPauseCampaignRequest } from "@/lib/execution/types";

export type MetaCampaignDetails = {
  id: string;
  name: string;
  effectiveStatus: string;
  accountId?: string;
};

export function buildMetaPauseCampaignRequest(input: {
  campaignId: string;
  campaignName: string;
  adAccountId: string;
}): MetaPauseCampaignRequest {
  const accountId = input.adAccountId.startsWith("act_")
    ? input.adAccountId
    : `act_${input.adAccountId}`;

  return {
    method: "POST",
    url: `https://graph.facebook.com/${META_GRAPH_VERSION}/${input.campaignId}`,
    body: { status: "PAUSED" },
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    adAccountId: accountId,
  };
}

export async function fetchMetaCampaign(
  accessToken: string,
  campaignId: string,
): Promise<MetaCampaignDetails> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${campaignId}`);
  url.searchParams.set("fields", "id,name,effective_status,account_id");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), { cache: "no-store" });
  const json = (await response.json()) as {
    id?: string;
    name?: string;
    effective_status?: string;
    account_id?: string;
    error?: { message: string };
  };

  if (!response.ok || json.error) {
    throw new Error(json.error?.message ?? `Meta API error (${response.status})`);
  }

  return {
    id: json.id ?? campaignId,
    name: json.name ?? campaignId,
    effectiveStatus: json.effective_status ?? "UNKNOWN",
    accountId: json.account_id,
  };
}

export async function pauseMetaCampaignLive(
  accessToken: string,
  request: MetaPauseCampaignRequest,
): Promise<{ success: boolean; response: unknown }> {
  const body = new URLSearchParams();
  body.set("status", request.body.status);
  body.set("access_token", accessToken);

  const response = await fetch(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  const json = await response.json();
  if (!response.ok) {
    const message =
      typeof json === "object" && json && "error" in json
        ? (json as { error?: { message?: string } }).error?.message
        : undefined;
    throw new Error(message ?? `Meta pause failed (${response.status})`);
  }

  return { success: true, response: json };
}

export function resolveMetaCampaignFromSnapshot(
  campaigns: MetaCampaign[],
  campaignId: string,
): MetaCampaign | undefined {
  return campaigns.find((c) => c.id === campaignId);
}
