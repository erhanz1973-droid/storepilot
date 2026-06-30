import { ensureValidationProvidersRegistered, requireValidationProvider } from "@/lib/validation/framework";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import { resolveActiveStoreId } from "@/lib/store/context";
import type { ValidationProviderId } from "@/lib/validation/framework/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PROVIDER_IDS: ValidationProviderId[] = ["meta", "google", "shopify", "ga4", "ai"];

function isProviderId(value: string): value is ValidationProviderId {
  return PROVIDER_IDS.includes(value as ValidationProviderId);
}

function disabledResponse() {
  return NextResponse.json({ enabled: false }, { status: 404 });
}

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(_request: Request, context: RouteContext) {
  if (!isDevValidationEnabled()) return disabledResponse();

  const { provider: providerParam } = await context.params;
  if (!isProviderId(providerParam)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  ensureValidationProvidersRegistered();
  const storeId = await resolveActiveStoreId();
  const provider = requireValidationProvider(providerParam);
  const result = await provider.runValidation(storeId, { runFresh: false });
  if (!result.enabled) return disabledResponse();

  return NextResponse.json(result);
}

export async function POST(request: Request, context: RouteContext) {
  if (!isDevValidationEnabled()) return disabledResponse();

  const { provider: providerParam } = await context.params;
  if (!isProviderId(providerParam)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  ensureValidationProvidersRegistered();
  const storeId = await resolveActiveStoreId();
  let runFresh = true;
  let user = "system";
  try {
    const body = (await request.json()) as { runFresh?: boolean; user?: string };
    if (body.runFresh === false) runFresh = false;
    if (body.user) user = body.user;
  } catch {
    // defaults
  }

  const provider = requireValidationProvider(providerParam);
  const result = await provider.runValidation(storeId, { runFresh, user });
  if (!result.enabled) return disabledResponse();

  return NextResponse.json(result);
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!isDevValidationEnabled()) return disabledResponse();

  const { provider: providerParam } = await context.params;
  if (!isProviderId(providerParam)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  ensureValidationProvidersRegistered();
  const storeId = await resolveActiveStoreId();
  const provider = requireValidationProvider(providerParam);
  if (provider.clearCache) await provider.clearCache(storeId);
  const result = await provider.runValidation(storeId, { runFresh: false });
  return NextResponse.json(result);
}
