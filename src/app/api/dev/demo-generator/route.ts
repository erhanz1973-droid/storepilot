import {
  refreshDashboardMetrics,
  resolveDemoShopContext,
  runDemoGeneratorAction,
  type DemoGeneratorAction,
} from "@/lib/dev/demo-generator";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function devOnly() {
  if (!isDevValidationEnabled()) {
    return NextResponse.json({ error: "Demo generator is development-only" }, { status: 404 });
  }
  return null;
}

function revalidateDashboards() {
  revalidatePath("/analytics/executive");
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/analytics/profit");
}

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const ctx = await resolveDemoShopContext();
    const metrics = await refreshDashboardMetrics(ctx);
    return NextResponse.json({ ok: true, shop: ctx, metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load demo generator";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  let body: { action?: DemoGeneratorAction };
  try {
    body = (await req.json()) as { action?: DemoGeneratorAction };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  try {
    const result = await runDemoGeneratorAction(action);
    revalidateDashboards();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demo generator failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
