import { buildBusinessContext } from "@/lib/ai/context-engine";
import { findRecommendation } from "@/lib/ai/explain";
import {
  getAvailableSimulations,
  runWhatIfSimulation,
  type SimulationType,
} from "@/lib/ai/what-if-engine";
import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { evaluateOpportunities } from "@/lib/opportunities/engine";
import { resolveActiveStoreId } from "@/lib/store/context";
import { NextResponse } from "next/server";
import { z } from "zod";

const simulationTypes = [
  "increase_price",
  "decrease_price",
  "increase_meta_budget",
  "increase_google_budget",
  "apply_discount",
  "pause_campaign",
  "restock_inventory",
  "create_bundle",
  "add_homepage_feature",
] as const;

const bodySchema = z
  .object({
    recommendationId: z.string().uuid().optional(),
    opportunityId: z.string().optional(),
    simulationType: z.enum(simulationTypes).optional(),
    priceChangePct: z.number().min(-0.5).max(0.5).optional(),
    budgetChangePct: z.number().min(0).max(1).optional(),
    restockPct: z.number().min(0.05).max(2).optional(),
  })
  .refine((d) => d.recommendationId || d.opportunityId, {
    message: "recommendationId or opportunityId required",
  });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recommendationId = searchParams.get("recommendationId") ?? undefined;
  const opportunityId = searchParams.get("opportunityId") ?? undefined;

  if (!recommendationId && !opportunityId) {
    return NextResponse.json({ error: "recommendationId or opportunityId required" }, { status: 400 });
  }

  const context = await buildBusinessContext();
  const { recommendation, opportunity } = await resolveTargets(
    context,
    recommendationId,
    opportunityId,
  );

  if (!recommendation && !opportunity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const available = getAvailableSimulations({ recommendation, opportunity });
  return NextResponse.json({ available });
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const context = await buildBusinessContext();
  const { recommendation, opportunity } = await resolveTargets(
    context,
    parsed.data.recommendationId,
    parsed.data.opportunityId,
  );

  if (!recommendation && !opportunity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const available = getAvailableSimulations({ recommendation, opportunity });
  const simulationType =
    parsed.data.simulationType ?? available[0];

  if (!simulationType || !available.includes(simulationType)) {
    return NextResponse.json(
      { error: "Simulation type not available for this opportunity", available },
      { status: 400 },
    );
  }

  const result = await runWhatIfSimulation(context, {
    simulationType,
    recommendation,
    opportunity,
    priceChangePct: parsed.data.priceChangePct,
    budgetChangePct: parsed.data.budgetChangePct,
    restockPct: parsed.data.restockPct,
  });

  if (!result) {
    return NextResponse.json({ error: "Could not run simulation" }, { status: 422 });
  }

  return NextResponse.json({ result, available });
}

async function resolveTargets(
  context: Awaited<ReturnType<typeof buildBusinessContext>>,
  recommendationId?: string,
  opportunityId?: string,
) {
  let recommendation = recommendationId
    ? findRecommendation(context, recommendationId)
    : undefined;

  let opportunity = opportunityId
    ? context.topOpportunities.find((o) => o.id === opportunityId)
    : undefined;

  if (opportunityId && !opportunity) {
    const storeId = await resolveActiveStoreId();
    const snapshot = await aggregateStoreSnapshot(storeId);
    opportunity = evaluateOpportunities(snapshot).find((o) => o.id === opportunityId);
  }

  if (!recommendation && opportunity?.recommendationId) {
    recommendation = findRecommendation(context, opportunity.recommendationId);
  }

  return { recommendation, opportunity };
}
