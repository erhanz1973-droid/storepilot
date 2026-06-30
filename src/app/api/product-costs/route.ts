import { bulkUpsertProductCosts, listProductCosts, upsertProductCost } from "@/lib/db/product-costs";
import { resolveActiveStoreId } from "@/lib/store/context";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const storeId = await resolveActiveStoreId();
  const costs = await listProductCosts(storeId);
  return NextResponse.json({ costs });
}

const upsertSchema = z.object({
  shopifyProductId: z.string().min(1),
  unitCost: z.number().min(0),
});

const bulkSchema = z.object({
  costs: z.array(
    z.object({
      shopifyProductId: z.string().min(1),
      unitCost: z.number().min(0),
    }),
  ),
});

export async function POST(request: Request) {
  const storeId = await resolveActiveStoreId();
  const json = await request.json();

  const bulk = bulkSchema.safeParse(json);
  if (bulk.success) {
    const count = await bulkUpsertProductCosts(storeId, bulk.data.costs, "csv_import");
    return NextResponse.json({ updated: count });
  }

  const single = upsertSchema.safeParse(json);
  if (!single.success) {
    return NextResponse.json({ error: single.error.flatten() }, { status: 400 });
  }

  const record = await upsertProductCost(
    storeId,
    single.data.shopifyProductId,
    single.data.unitCost,
    "manual",
  );
  return NextResponse.json({ cost: record });
}
