import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return NextResponse.json({
    reached: true,
    url: request.url,
    timestamp: new Date().toISOString(),
  });
}
