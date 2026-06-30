import { getGa4OAuthPending } from "@/lib/db/ga4";
import { listGa4AccountSummaries } from "@/lib/ga4/api";
import { getGa4OAuthConfig } from "@/lib/ga4/oauth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const config = getGa4OAuthConfig();
  if (!config) {
    return NextResponse.json({ error: "GA4 OAuth is not configured" }, { status: 503 });
  }

  const sessionId = new URL(request.url).searchParams.get("session");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }

  const pending = await getGa4OAuthPending(sessionId);
  if (!pending) {
    return NextResponse.json({ error: "Session expired or invalid" }, { status: 404 });
  }

  try {
    const accounts = await listGa4AccountSummaries(pending.accessToken);
    return NextResponse.json({
      googleUserEmail: pending.google_user_email,
      accounts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list GA4 accounts";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
