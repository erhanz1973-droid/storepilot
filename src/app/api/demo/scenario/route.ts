import { NextResponse } from "next/server";
import { buildDemoSnapshot, resolveDemoScenarioId } from "@/lib/demo/get-demo-snapshot";
import { DEMO_SCENARIO_LIST } from "@/lib/demo/scenarios/registry";
import { demoScenarioCookieValue, getActiveDemoScenarioId } from "@/lib/demo/scenario-context";
import { activeStoreCookieValue } from "@/lib/store/context";
import { DEMO_STORE_ID } from "@/lib/types";
import { allowDemoData, isProductionRuntime } from "@/lib/env/runtime";

/**
 * Demo scenario API — development opt-in only.
 * Production must never return synthetic KPIs (Shopify App Store requirement).
 */
function demoDisabled() {
  return NextResponse.json(
    { error: "Not found" },
    { status: 404 },
  );
}

function demoAllowed(): boolean {
  if (isProductionRuntime()) return false;
  return allowDemoData();
}

export async function GET() {
  if (!demoAllowed()) return demoDisabled();
  const activeId = await getActiveDemoScenarioId();
  const active = DEMO_SCENARIO_LIST.find((s) => s.id === activeId) ?? DEMO_SCENARIO_LIST[0]!;
  return NextResponse.json({
    activeId,
    active,
    scenarios: DEMO_SCENARIO_LIST.map((s) => ({
      id: s.id,
      label: s.label,
      description: s.description,
      personality: s.personality,
      revenue30d: s.revenue30d,
      storeHealthScore: s.storeHealthScore,
    })),
  });
}

export async function POST(request: Request) {
  if (!demoAllowed()) return demoDisabled();
  const body = (await request.json()) as { scenarioId?: string };
  const scenarioId = resolveDemoScenarioId(body.scenarioId);
  const cookie = demoScenarioCookieValue(scenarioId);
  const storeCookie = activeStoreCookieValue(DEMO_STORE_ID);
  const response = NextResponse.json({
    ok: true,
    scenarioId,
    storeId: DEMO_STORE_ID,
    scenario: DEMO_SCENARIO_LIST.find((s) => s.id === scenarioId),
    preview: {
      revenue30d: buildDemoSnapshot(scenarioId).storeMetrics.revenue30d,
    },
  });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  response.cookies.set(storeCookie.name, storeCookie.value, storeCookie.options);
  return response;
}
