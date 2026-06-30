import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveMerchantBusinessProfile } from "@/lib/business-model/profile";
import { upsertStoreBusinessProfile } from "@/lib/db/business-profile";
import { getVerifiedStoreData } from "@/lib/recommendations/validation";
import { listProductCosts } from "@/lib/db/product-costs";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import { resolveActiveStoreId } from "@/lib/store/context";
import { detectBusinessModelFromSnapshot } from "@/lib/business-model/detection";
import type { BusinessModel, MerchantBusinessProfile } from "@/lib/business-model/types";
import {
  inventoryStrategyForBusinessModel,
  normalizeBusinessModel,
} from "@/lib/business-model/types";

export async function GET() {
  const storeId = await resolveActiveStoreId();
  const { snapshot } = await getVerifiedStoreData(storeId);
  const costRecords = await listProductCosts(storeId);
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  const productIntelligence = buildProductIntelligence(snapshot, costRecords, profitDashboard);
  const profile = await resolveMerchantBusinessProfile({
    storeId,
    snapshot,
    profitDashboard,
    productIntelligence,
  });
  const detection = detectBusinessModelFromSnapshot({ snapshot, profitDashboard });

  return NextResponse.json({ profile, detection });
}

export async function POST(request: Request) {
  const storeId = await resolveActiveStoreId();
  const body = (await request.json()) as Partial<MerchantBusinessProfile>;

  const businessModel = normalizeBusinessModel(body.businessModel);
  const profile = await upsertStoreBusinessProfile(storeId, {
    ...body,
    businessModel,
    businessModelSource: "manual",
    inventoryStrategy: inventoryStrategyForBusinessModel(businessModel),
  });

  const { snapshot } = await getVerifiedStoreData(storeId);
  const costRecords = await listProductCosts(storeId);
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  const productIntelligence = buildProductIntelligence(snapshot, costRecords, profitDashboard);
  const resolved = await resolveMerchantBusinessProfile({
    storeId,
    snapshot,
    profitDashboard,
    productIntelligence,
  });

  revalidatePath("/decisions");
  revalidatePath("/settings");
  revalidatePath("/");

  return NextResponse.json({ profile: resolved });
}
