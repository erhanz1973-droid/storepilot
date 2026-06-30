import { NextResponse } from "next/server";
import { disconnectMetaAdsInstallation } from "@/lib/db/meta-ads";
import { resolveActiveStoreId } from "@/lib/store/context";

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get("id");
  if (!installationId) {
    return NextResponse.json({ error: "Missing installation id" }, { status: 400 });
  }

  const storeId = await resolveActiveStoreId();
  await disconnectMetaAdsInstallation(storeId, installationId);
  return NextResponse.json({ ok: true });
}
