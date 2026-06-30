import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import { detectBusinessModelFromSnapshot } from "./detection";
import {
  getStoreBusinessProfile,
  upsertStoreBusinessProfile,
} from "@/lib/db/business-profile";
import type { BusinessModel, MerchantBusinessProfile } from "./types";
import {
  inventoryStrategyForBusinessModel,
  normalizeBusinessModel,
} from "./types";

function enrichProfile(
  profile: MerchantBusinessProfile,
  input: {
    snapshot: StoreSnapshot;
    profitDashboard?: ProfitDashboard | null;
    detection: ReturnType<typeof detectBusinessModelFromSnapshot>;
    inferredAov?: number;
    inferredMargin?: number;
    adChannels: string[];
  },
): MerchantBusinessProfile {
  const inventoryStrategy =
    profile.businessModelSource === "manual"
      ? inventoryStrategyForBusinessModel(profile.businessModel)
      : profile.inventoryStrategy ??
        inventoryStrategyForBusinessModel(profile.businessModel);

  return {
    ...profile,
    detectedBusinessModel: input.detection.detectedModel,
    detectionConfidence: input.detection.confidence,
    detectionSignals: input.detection.signals,
    averageOrderValue: profile.averageOrderValue ?? input.inferredAov,
    typicalMarginPct: profile.typicalMarginPct ?? input.inferredMargin,
    inventoryStrategy,
    advertisingChannels: profile.advertisingChannels?.length
      ? profile.advertisingChannels
      : input.adChannels,
  };
}

/** Active model — manual selection always wins; detection is suggestion-only. */
function resolveActiveBusinessModel(stored: MerchantBusinessProfile | null): {
  businessModel: BusinessModel;
  businessModelSource: MerchantBusinessProfile["businessModelSource"];
} {
  if (stored?.businessModelSource === "manual") {
    return {
      businessModel: normalizeBusinessModel(stored.businessModel),
      businessModelSource: "manual",
    };
  }

  if (stored?.businessModel && stored.businessModelSource !== "detected") {
    return {
      businessModel: normalizeBusinessModel(stored.businessModel),
      businessModelSource: stored.businessModelSource ?? "default",
    };
  }

  // Default to own inventory — do not auto-apply detected model as active.
  return {
    businessModel: "own_inventory",
    businessModelSource: stored?.businessModelSource ?? "default",
  };
}

export async function resolveMerchantBusinessProfile(input: {
  storeId: string;
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  productIntelligence?: ProductIntelligenceDashboard | null;
}): Promise<MerchantBusinessProfile> {
  const stored = await getStoreBusinessProfile(input.storeId);
  const detection = detectBusinessModelFromSnapshot({
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
  });

  const inferredAov =
    input.snapshot.storeMetrics?.aov30d ??
    (input.snapshot.storeMetrics?.orders30d > 0
      ? input.snapshot.storeMetrics.revenue30d / input.snapshot.storeMetrics.orders30d
      : undefined);

  const inferredMargin = input.profitDashboard?.primary.profitMarginPct ?? undefined;
  const adChannels = [
    input.snapshot.connectorStates?.meta_ads === "connected" ? "meta_ads" : null,
    input.snapshot.connectorStates?.google_ads === "connected" ? "google_ads" : null,
    input.snapshot.connectorStates?.tiktok === "connected" ? "tiktok" : null,
  ].filter(Boolean) as string[];

  const enrichInput = {
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
    detection,
    inferredAov,
    inferredMargin,
    adChannels,
  };

  const active = resolveActiveBusinessModel(stored);

  const profile: MerchantBusinessProfile = enrichProfile(
    {
      storeId: input.storeId,
      businessModel: active.businessModel,
      businessModelSource: active.businessModelSource,
      primarySalesChannel: stored?.primarySalesChannel ?? "shopify",
      averageOrderValue: stored?.averageOrderValue,
      typicalMarginPct: stored?.typicalMarginPct,
      inventoryStrategy:
        stored?.inventoryStrategy ??
        inventoryStrategyForBusinessModel(active.businessModel),
      advertisingChannels: stored?.advertisingChannels,
      primaryAcquisitionChannel: stored?.primaryAcquisitionChannel,
      hybridModelWeights: stored?.hybridModelWeights,
    },
    enrichInput,
  );

  const latest = await getStoreBusinessProfile(input.storeId);
  if (latest?.businessModelSource === "manual") {
    return enrichProfile(
      {
        ...latest,
        businessModel: normalizeBusinessModel(latest.businessModel),
      },
      enrichInput,
    );
  }

  // Persist detection signals only — never overwrite manual active model.
  await upsertStoreBusinessProfile(input.storeId, {
    businessModel: latest?.businessModel ?? profile.businessModel,
    businessModelSource: latest?.businessModelSource ?? profile.businessModelSource,
    detectedBusinessModel: detection.detectedModel,
    detectionConfidence: detection.confidence,
    detectionSignals: detection.signals,
    inventoryStrategy:
      latest?.inventoryStrategy ?? profile.inventoryStrategy,
  });

  return profile;
}

export function normalizeMerchantBusinessProfile(
  raw?: Partial<MerchantBusinessProfile> | null,
): MerchantBusinessProfile | null {
  if (!raw?.storeId) return null;
  return {
    ...raw,
    storeId: raw.storeId,
    businessModel: normalizeBusinessModel(raw.businessModel),
    businessModelSource: raw.businessModelSource ?? "default",
  };
}
