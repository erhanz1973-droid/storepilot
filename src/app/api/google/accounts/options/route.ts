import { getGoogleOAuthPending } from "@/lib/db/google-ads";
import { listGoogleCustomersWithNames } from "@/lib/google-ads/api";
import { getGoogleAdsConfig } from "@/lib/google-ads/oauth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const config = getGoogleAdsConfig();
  if (!config) {
    return NextResponse.json({ error: "Google Ads OAuth is not configured" }, { status: 503 });
  }

  const sessionId = new URL(request.url).searchParams.get("session");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }

  const pending = await getGoogleOAuthPending(sessionId);
  if (!pending) {
    return NextResponse.json({ error: "Session expired or invalid" }, { status: 404 });
  }

  try {
    const customers = await listGoogleCustomersWithNames(pending.accessToken);
    return NextResponse.json({
      googleUserEmail: pending.google_user_email,
      customers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list customers";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
