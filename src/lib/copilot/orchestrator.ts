import type { AiChatMessage, AiActionCard, AskAiResponse } from "@/lib/ai/types";
import { loadCopilotData } from "./data";
import { attachInsightMetadata } from "./insight-engine";
import { handleCopilotIntent } from "./handlers";
import { detectCopilotIntent, resolveFollowUpIntent } from "./intents";
import { formatCopilotMessage } from "./response";
import { getCopilotSession, recordCopilotTurn } from "./session";
import type { CopilotStructuredResponse } from "./types";

export type CopilotQueryContext = {
  pageContext?: string;
  recommendationTitle?: string;
  recommendationId?: string;
  decisionId?: string;
};

export async function runCopilotQuery(
  question: string,
  sessionId: string,
  queryContext?: CopilotQueryContext,
): Promise<AskAiResponse & { structured: CopilotStructuredResponse }> {
  const session = getCopilotSession(sessionId);
  const { intent, expandedQuestion } = resolveFollowUpIntent(
    question,
    session.lastIntent,
    queryContext?.pageContext,
  );

  const bundle = await loadCopilotData();
  const structured = attachInsightMetadata(
    handleCopilotIntent(intent, bundle),
    bundle,
    question,
  );

  let summary = structured.summary;
  if (queryContext?.recommendationTitle) {
    const recHint = `Regarding your recommendation "${queryContext.recommendationTitle}": `;
    if (!summary.toLowerCase().includes(queryContext.recommendationTitle.toLowerCase().slice(0, 12))) {
      summary = `${recHint}${summary}`;
    }
  }
  if (queryContext?.pageContext === "executive") {
    summary = `${summary}\n\n(Context: executive dashboard — profit, recovery, and priority actions.)`;
  }
  if (queryContext?.pageContext === "customers" && structured.intent.startsWith("customer")) {
    summary = `${summary}\n\n(Context: Customer Intelligence — sourced from synced customer and order data.)`;
  }

  const content = formatCopilotMessage({ ...structured, summary });
  recordCopilotTurn(sessionId, {
    userQuestion: question,
    assistantSummary: structured.summary,
    intent,
  });

  const actionCards: AiActionCard[] = structured.recommendations.map((rec) => ({
    title: rec.action,
    reason: rec.detail,
    expectedImpact: structured.businessImpact.label || "See impact above",
    confidence: structured.confidencePct / 100,
    actionLabel: rec.futureAction
      ? `${rec.futureAction.replace(/_/g, " ")}${rec.available ? "" : " (coming soon)"}`
      : "Review",
  }));

  const message: AiChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    structured: { ...structured, summary },
    actionCards: actionCards.length > 0 ? actionCards : undefined,
    createdAt: new Date().toISOString(),
  };

  return { message, sessionId, structured: { ...structured, summary } };
}

export { COPILOT_SUGGESTED_PROMPTS } from "./types";
export type { CopilotStructuredResponse, CopilotIntent } from "./types";
