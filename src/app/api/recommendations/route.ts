import { recommendationService } from "@/lib/recommendations/service";
import { resolveActiveStoreId } from "@/lib/store/context";
import { NextResponse } from "next/server";

export async function GET() {
  const storeId = await resolveActiveStoreId();
  const recommendations = await recommendationService.list(storeId);
  return NextResponse.json({ recommendations });
}
