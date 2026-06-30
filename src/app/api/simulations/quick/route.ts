import { buildBusinessContext } from "@/lib/ai/context-engine";
import { runWhatIfSimulation, type SimulationType } from "@/lib/ai/what-if-engine";
import { NextResponse } from "next/server";
import { z } from "zod";

const QUICK_TYPES = [
  "increase_google_budget",
  "increase_meta_budget",
  "apply_discount",
] as const;

const bodySchema = z.object({
  simulationType: z.enum(QUICK_TYPES),
  budgetChangePct: z.number().min(0).max(1).optional(),
  priceChangePct: z.number().min(0).max(0.5).optional(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const context = await buildBusinessContext();
  const result = await runWhatIfSimulation(context, {
    simulationType: parsed.data.simulationType as SimulationType,
    budgetChangePct: parsed.data.budgetChangePct,
    priceChangePct: parsed.data.priceChangePct,
  });

  if (!result) {
    return NextResponse.json({ error: "Could not run simulation" }, { status: 422 });
  }

  return NextResponse.json({ result });
}
