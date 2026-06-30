import { getHistory } from "@/lib/services/dashboard";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const history = await getHistory({
    status: status as Parameters<typeof getHistory>[0] extends { status?: infer S } ? S : never,
    priority,
    category,
  });

  return NextResponse.json({ history });
}
