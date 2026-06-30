import { buildValidationMetrics, runAndCacheValidation } from "@/lib/services/validation-dashboard";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const run = searchParams.get("run") === "1";

  if (run) {
    const { report, metrics } = await runAndCacheValidation();
    return NextResponse.json({ report, metrics });
  }

  const metrics = await buildValidationMetrics();
  return NextResponse.json({ metrics });
}

export async function POST() {
  const { report, metrics } = await runAndCacheValidation();
  return NextResponse.json({ report, metrics });
}
