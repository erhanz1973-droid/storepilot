import { buildBusinessContext } from "@/lib/ai/context-engine";
import { findRecommendation } from "@/lib/ai/explain";
import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { buildRecommendationEvidence } from "@/lib/evidence/explorer";
import { evaluateOpportunities } from "@/lib/opportunities/engine";
import { resolveActiveStoreId } from "@/lib/store/context";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z
  .object({
    recommendationId: z.string().uuid().optional(),
    opportunityId: z.string().optional(),
  })
  .refine((d) => d.recommendationId || d.opportunityId, {
    message: "recommendationId or opportunityId required",
  });

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const context = await buildBusinessContext();

  let recommendation = parsed.data.recommendationId
    ? findRecommendation(context, parsed.data.recommendationId)
    : undefined;

  let opportunity = parsed.data.opportunityId
    ? context.topOpportunities.find((o) => o.id === parsed.data.opportunityId)
    : undefined;

  if (parsed.data.opportunityId && !opportunity) {
    const storeId = await resolveActiveStoreId();
    const snapshot = await aggregateStoreSnapshot(storeId);
    opportunity = evaluateOpportunities(snapshot).find(
      (o) => o.id === parsed.data.opportunityId,
    );
  }

  if (!recommendation && !opportunity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!recommendation && opportunity?.recommendationId) {
    recommendation = findRecommendation(context, opportunity.recommendationId);
  }

  const evidence = await buildRecommendationEvidence(context, {
    recommendation,
    opportunity,
  });

  return NextResponse.json({ evidence });
}
