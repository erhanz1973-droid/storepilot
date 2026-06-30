import { runCopilotQuery } from "@/lib/copilot/orchestrator";
import { getCopilotSession } from "@/lib/copilot/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
  pageContext: z.string().optional(),
  recommendationTitle: z.string().optional(),
  recommendationId: z.string().optional(),
  decisionId: z.string().optional(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sessionId = parsed.data.sessionId ?? crypto.randomUUID();
  getCopilotSession(sessionId);

  const result = await runCopilotQuery(parsed.data.message, sessionId, {
    pageContext: parsed.data.pageContext,
    recommendationTitle: parsed.data.recommendationTitle,
    recommendationId: parsed.data.recommendationId,
    decisionId: parsed.data.decisionId,
  });

  const response = NextResponse.json({
    ...result,
    userMessage: {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: parsed.data.message,
      createdAt: new Date().toISOString(),
    },
  });

  response.cookies.set("ask_ai_session_id", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}
