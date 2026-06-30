import {
  ensureValidationProvidersRegistered,
  requireValidationProvider,
} from "@/lib/validation/framework";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import { resolveActiveStoreId } from "@/lib/store/context";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function disabledResponse() {
  return NextResponse.json({ enabled: false }, { status: 404 });
}

export async function GET() {
  if (!isDevValidationEnabled()) return disabledResponse();

  ensureValidationProvidersRegistered();
  const storeId = await resolveActiveStoreId();
  const provider = requireValidationProvider("meta");
  const panel = await provider.runValidation(storeId);
  if (!panel.enabled) return disabledResponse();

  return NextResponse.json(panel);
}

export async function POST(request: Request) {
  if (!isDevValidationEnabled()) return disabledResponse();

  ensureValidationProvidersRegistered();
  const storeId = await resolveActiveStoreId();
  let runFresh = true;
  try {
    const body = (await request.json()) as { runFresh?: boolean };
    if (body.runFresh === false) runFresh = false;
  } catch {
    // default run fresh
  }

  const provider = requireValidationProvider("meta");
  const panel = await provider.runValidation(storeId, { runFresh });
  if (!panel.enabled) return disabledResponse();

  return NextResponse.json(panel);
}

export async function DELETE() {
  if (!isDevValidationEnabled()) return disabledResponse();

  ensureValidationProvidersRegistered();
  const storeId = await resolveActiveStoreId();
  const provider = requireValidationProvider("meta");
  if (provider.clearCache) await provider.clearCache(storeId);
  const panel = await provider.runValidation(storeId);
  return NextResponse.json(panel);
}
