import { buildFeedbackContext } from "@/lib/feedback/context";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get("page") ?? "/";
  const browser = request.headers.get("user-agent") ?? "unknown";
  const recommendationId = request.nextUrl.searchParams.get("recommendationId");

  const context = await buildFeedbackContext({
    page,
    browser,
    recommendationId,
  });

  return NextResponse.json(context);
}
