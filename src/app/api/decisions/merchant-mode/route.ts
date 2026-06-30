import { normalizeMerchantMode } from "@/lib/decisions/merchant-mode";
import { MERCHANT_MODE_COOKIE, resolveMerchantMode } from "@/lib/store/merchant-mode";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["profit", "cash_flow", "growth", "inventory_clearance", "launch"]),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const mode = normalizeMerchantMode(parsed.data.mode);
  const response = NextResponse.json({ ok: true, mode });
  response.cookies.set(MERCHANT_MODE_COOKIE, mode, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function GET() {
  const mode = await resolveMerchantMode();
  return NextResponse.json({ mode });
}
