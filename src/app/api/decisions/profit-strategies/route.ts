import { buildProfitDecisionPlan } from "@/lib/services/profit-decisions";
import { compareSlowProductStrategies, simulateCustomDiscount } from "@/lib/decisions/strategy-comparison";
import { productEconomicsFromSnapshot } from "@/lib/decisions/product-economics";
import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { listProductCosts } from "@/lib/db/product-costs";
import { resolveActiveStoreId } from "@/lib/store/context";
import { normalizeMerchantMode } from "@/lib/decisions/merchant-mode";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId") ?? undefined;

  const plan = await buildProfitDecisionPlan();

  if (productId) {
    const comparison = plan.slowProductStrategies.find((s) => s.productId === productId);
    if (!comparison) {
      return NextResponse.json({ error: "Product not found in strategy set" }, { status: 404 });
    }
    return NextResponse.json({ comparison, merchantMode: plan.merchantMode });
  }

  return NextResponse.json(plan);
}

const postSchema = z.object({
  productId: z.string().optional(),
  discountPct: z.number().min(0.01).max(0.5).optional(),
  merchantMode: z
    .enum(["profit", "cash_flow", "growth", "inventory_clearance", "launch"])
    .optional(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const storeId = await resolveActiveStoreId();
  const snapshot = await aggregateStoreSnapshot(storeId);
  const costRecords = await listProductCosts(storeId);
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  if (!profitDashboard) {
    return NextResponse.json({ error: "Profit data unavailable" }, { status: 422 });
  }
  const mode = normalizeMerchantMode(parsed.data.merchantMode);

  const product = productEconomicsFromSnapshot(
    snapshot,
    profitDashboard,
    parsed.data.productId,
  );
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (parsed.data.discountPct != null) {
    const comparison = simulateCustomDiscount({
      product,
      discountPct: parsed.data.discountPct,
      profitDashboard,
      merchantMode: mode,
    });
    return NextResponse.json({ comparison, merchantMode: mode });
  }

  const comparison = compareSlowProductStrategies({
    product,
    profitDashboard,
    merchantMode: mode,
  });

  return NextResponse.json({ comparison, merchantMode: mode });
}
