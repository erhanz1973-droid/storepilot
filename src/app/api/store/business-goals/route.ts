import { NextResponse } from "next/server";
import { getStoreBusinessGoals, upsertStoreBusinessGoals } from "@/lib/db/business-goals";
import { resolveActiveStoreId } from "@/lib/store/context";
import {
  ALL_BUSINESS_GOALS,
  BUSINESS_GOAL_LABELS,
  type BusinessGoal,
  normalizeBusinessGoals,
} from "@/lib/business-goals/types";

export async function GET() {
  const storeId = await resolveActiveStoreId();
  const goals = await getStoreBusinessGoals(storeId);

  return NextResponse.json({
    goals,
    options: ALL_BUSINESS_GOALS.map((id) => ({
      id,
      label: BUSINESS_GOAL_LABELS[id],
    })),
  });
}

export async function POST(request: Request) {
  const storeId = await resolveActiveStoreId();
  const body = (await request.json()) as {
    goals?: string[];
    primaryGoal?: string;
  };

  const goals = body.goals ? normalizeBusinessGoals(body.goals) : undefined;
  const primaryGoal = body.primaryGoal as BusinessGoal | undefined;

  const updated = await upsertStoreBusinessGoals(storeId, {
    goals,
    primaryGoal,
  });

  return NextResponse.json({ goals: updated });
}
