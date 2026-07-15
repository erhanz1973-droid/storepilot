import { NextResponse } from "next/server";
import { finalizeSmokeReport, runDirectSmokeChecks } from "@/lib/smoke/suite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function authorize(request: Request): boolean {
  const secret =
    process.env.SMOKE_SECRET?.trim() || process.env.STOREPILOT_INTERNAL_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const alt = request.headers.get("x-smoke-secret") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header || alt;
  return token === secret;
}

/**
 * Production smoke suite — read-only / dry-run only.
 * Never mutates merchant data (Shopify/Meta/Google).
 *
 * Auth: Authorization: Bearer $SMOKE_SECRET (or STOREPILOT_INTERNAL_SECRET)
 */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const url = new URL(request.url);
  const baseUrl =
    process.env.SMOKE_BASE_URL?.trim() ||
    process.env.SHOPIFY_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    `${url.protocol}//${url.host}`;

  try {
    const checks = await runDirectSmokeChecks({ baseUrl });
    const report = finalizeSmokeReport({ checks, startedAt, baseUrl });
    return NextResponse.json(report, { status: report.ok ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        final: "FAIL",
        error: message,
        startedAt,
        finishedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
