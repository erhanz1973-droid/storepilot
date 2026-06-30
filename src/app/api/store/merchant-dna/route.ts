import { NextResponse } from "next/server";
import { resolveMerchantBusinessProfile } from "@/lib/business-model/profile";
import { getVerifiedStoreData } from "@/lib/recommendations/validation";
import { listProductCosts } from "@/lib/db/product-costs";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import { resolveActiveStoreId } from "@/lib/store/context";
import { patchMerchantDnaOverrides } from "@/lib/db/merchant-dna";
import { resolveMerchantDNA } from "@/lib/merchant-dna/resolver";
import type { MerchantDNAManualOverrides } from "@/lib/merchant-dna/types";

export async function GET() {
  const storeId = await resolveActiveStoreId();
  const { snapshot } = await getVerifiedStoreData(storeId);
  const costRecords = await listProductCosts(storeId);
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  const productIntelligence = buildProductIntelligence(snapshot, costRecords, profitDashboard);
  const businessProfile = await resolveMerchantBusinessProfile({
    storeId,
    snapshot,
    profitDashboard,
    productIntelligence,
  });
  const { dna, benchmark } = await resolveMerchantDNA({
    storeId,
    businessProfile,
    snapshot,
    profitDashboard,
    productIntelligence,
  });

  return NextResponse.json({ dna, benchmark });
}

export async function POST(request: Request) {
  const storeId = await resolveActiveStoreId();
  const body = (await request.json()) as MerchantDNAManualOverrides;
  await patchMerchantDnaOverrides(storeId, body);

  const { snapshot } = await getVerifiedStoreData(storeId);
  const costRecords = await listProductCosts(storeId);
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  const productIntelligence = buildProductIntelligence(snapshot, costRecords, profitDashboard);
  const businessProfile = await resolveMerchantBusinessProfile({
    storeId,
    snapshot,
    profitDashboard,
    productIntelligence,
  });
  const { dna, benchmark } = await resolveMerchantDNA({
    storeId,
    businessProfile,
    snapshot,
    profitDashboard,
    productIntelligence,
  });

  return NextResponse.json({ dna, benchmark });
}
