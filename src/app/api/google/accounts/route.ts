import { disconnectGoogleAdsInstallation } from "@/lib/db/google-ads";
import { resolveActiveStoreId } from "@/lib/store/context";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  const storeId = await resolveActiveStoreId();
  const installationId = new URL(request.url).searchParams.get("id");
  if (!installationId) {
    return NextResponse.json({ error: "Missing installation id" }, { status: 400 });
  }

  await disconnectGoogleAdsInstallation(storeId, installationId);
  return NextResponse.json({ ok: true });
}
