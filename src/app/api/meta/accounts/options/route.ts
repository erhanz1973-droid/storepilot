import { NextResponse } from "next/server";
import { getMetaOAuthPending } from "@/lib/db/meta-ads";
import { listBusinessesWithAdAccounts } from "@/lib/meta/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }

  const pending = await getMetaOAuthPending(sessionId);
  if (!pending) {
    return NextResponse.json({ error: "Session expired or invalid" }, { status: 404 });
  }

  try {
    const businesses = await listBusinessesWithAdAccounts(pending.accessToken);
    return NextResponse.json({
      sessionId: pending.id,
      metaUserName: pending.meta_user_name,
      businesses,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load ad accounts";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
