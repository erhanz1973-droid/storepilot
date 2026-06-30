import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { getSelectedMetaAdsInstallationWithToken } from "@/lib/db/meta-ads";
import type { ExecutionActionHandler } from "@/lib/execution/provider";
import type { ActionExecutionContext } from "@/lib/execution/types";
import {
  buildMetaPauseCampaignRequest,
  fetchMetaCampaign,
  pauseMetaCampaignLive,
  resolveMetaCampaignFromSnapshot,
} from "@/lib/meta/campaign-mutations";
import { syncMetaAdsForStore } from "@/lib/meta/store-sync";

type MetaPauseContext = {
  installation: NonNullable<Awaited<ReturnType<typeof getSelectedMetaAdsInstallationWithToken>>>;
  campaignName: string;
  adAccountId: string;
  effectiveStatus?: string;
};

async function resolveMetaPauseContext(
  ctx: ActionExecutionContext,
): Promise<{ errors: string[]; data?: MetaPauseContext }> {
  const errors: string[] = [];
  const installation = await getSelectedMetaAdsInstallationWithToken(ctx.storeId);

  if (!installation) {
    errors.push("Meta Ads is not connected.");
  } else if (installation.connection_health === "error") {
    errors.push("Meta Ads integration is in an error state.");
  }

  const snapshot = await aggregateStoreSnapshot(ctx.storeId);
  const localCampaign = resolveMetaCampaignFromSnapshot(snapshot.campaigns, ctx.entityId);

  if (!localCampaign && !installation) {
    errors.push(`Campaign ${ctx.entityId} was not found in synced store data.`);
    return { errors };
  }

  let campaignName = ctx.entityName || localCampaign?.name || ctx.entityId;
  let adAccountId = localCampaign?.adAccountId ?? installation?.ad_account_id;
  let effectiveStatus: string | undefined = localCampaign?.effectiveStatus;

  if (installation) {
    try {
      const remote = await fetchMetaCampaign(installation.accessToken, ctx.entityId);
      campaignName = remote.name;
      effectiveStatus = remote.effectiveStatus;
      adAccountId = remote.accountId ?? adAccountId;
    } catch (err) {
      if (!localCampaign) {
        errors.push(
          err instanceof Error ? err.message : "Unable to verify campaign with Meta API.",
        );
      }
    }
  }

  if (!adAccountId) {
    errors.push("Could not determine which Meta ad account owns this campaign.");
  }

  if (effectiveStatus === "PAUSED") {
    errors.push("Campaign is already paused.");
  }

  if (errors.length > 0 || !installation || !adAccountId) {
    return { errors };
  }

  return {
    errors: [],
    data: {
      installation,
      campaignName,
      adAccountId,
      effectiveStatus,
    },
  };
}

export const metaPauseCampaignHandler: ExecutionActionHandler = {
  id: "meta_ads:pause_campaign",
  platform: "meta_ads",
  actionType: "pause_campaign",
  entityTypes: ["campaign"],
  label: "Pause Campaign",

  async validate(ctx) {
    const resolved = await resolveMetaPauseContext(ctx);
    if (resolved.errors.length > 0) {
      return { valid: false, errors: resolved.errors };
    }
    return {
      valid: true,
      errors: [],
      entityName: resolved.data!.campaignName,
      context: resolved.data as unknown as Record<string, unknown>,
    };
  },

  async buildRequest(ctx, validation) {
    const data = validation.context as unknown as MetaPauseContext;
    const request = buildMetaPauseCampaignRequest({
      campaignId: ctx.entityId,
      campaignName: data.campaignName,
      adAccountId: data.adAccountId,
    });
    return {
      payload: request as unknown as Record<string, unknown>,
      label: `Pause Campaign — ${data.campaignName}`,
    };
  },

  async executeLive(ctx, request, validation) {
    const data = validation.context as unknown as MetaPauseContext;
    const result = await pauseMetaCampaignLive(
      data.installation.accessToken,
      request.payload as ReturnType<typeof buildMetaPauseCampaignRequest>,
    );
    return { payload: result.response as Record<string, unknown> };
  },

  async afterSuccess(ctx) {
    try {
      await syncMetaAdsForStore(ctx.storeId);
    } catch {
      // Non-fatal
    }
  },
};

/** @deprecated Use executeApprovedAction via pipeline */
export async function executePauseMetaCampaign(
  ctx: ActionExecutionContext,
): Promise<import("@/lib/execution/types").ActionExecutionOutcome> {
  const { runExecutionPipeline } = await import("@/lib/execution/pipeline");
  return runExecutionPipeline(ctx, metaPauseCampaignHandler);
}
