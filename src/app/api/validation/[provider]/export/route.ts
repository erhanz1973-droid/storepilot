import {
  ensureValidationProvidersRegistered,
  exportReportAsHtml,
  exportReportAsJson,
  requireValidationProvider,
} from "@/lib/validation/framework";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import { resolveActiveStoreId } from "@/lib/store/context";
import type { ValidationProviderId } from "@/lib/validation/framework/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PROVIDER_IDS: ValidationProviderId[] = ["meta", "google", "shopify", "ga4", "ai"];

function isProviderId(value: string): value is ValidationProviderId {
  return PROVIDER_IDS.includes(value as ValidationProviderId);
}

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: Request, context: RouteContext) {
  if (!isDevValidationEnabled()) {
    return NextResponse.json({ enabled: false }, { status: 404 });
  }

  const { provider: providerParam } = await context.params;
  if (!isProviderId(providerParam)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "json";

  ensureValidationProvidersRegistered();
  const storeId = await resolveActiveStoreId();
  const provider = requireValidationProvider(providerParam);
  const report = await provider.exportReport(storeId);
  if (!report) {
    return NextResponse.json({ error: "Export unavailable" }, { status: 404 });
  }

  if (format === "html") {
    const html = exportReportAsHtml(report);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="validation-${providerParam}-${Date.now()}.html"`,
      },
    });
  }

  const json = exportReportAsJson(report);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="validation-${providerParam}-${Date.now()}.json"`,
    },
  });
}
