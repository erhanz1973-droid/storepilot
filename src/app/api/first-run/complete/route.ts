import { NextResponse } from "next/server";
import { trackAlphaEvent } from "@/lib/analytics/alpha-funnel";
import { FIRST_RUN_DONE_COOKIE } from "@/lib/first-run/gate";
import { resolveActiveStoreId } from "@/lib/store/context";

export const dynamic = "force-dynamic";

export async function POST() {
  const storeId = await resolveActiveStoreId();
  await trackAlphaEvent(storeId, "first_run_completed", { source: "first_run" });

  const response = NextResponse.json({ ok: true, storeId });
  response.cookies.set(FIRST_RUN_DONE_COOKIE, storeId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
