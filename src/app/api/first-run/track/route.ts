import { NextResponse } from "next/server";
import { z } from "zod";
import { trackAlphaEvent } from "@/lib/analytics/alpha-funnel";
import { resolveActiveStoreId } from "@/lib/store/context";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  event: z.string().min(1).max(80),
  props: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const storeId = await resolveActiveStoreId();
  await trackAlphaEvent(storeId, parsed.data.event, parsed.data.props ?? {});
  return NextResponse.json({ ok: true });
}
