import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALPHA_COOKIE = "storepilot_alpha_dashboard";

export async function GET(request: Request) {
  const secret = process.env.STOREPILOT_INTERNAL_SECRET?.trim();
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!secret || !token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.redirect(new URL("/internal/alpha", url.origin));
  response.cookies.set(ALPHA_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
