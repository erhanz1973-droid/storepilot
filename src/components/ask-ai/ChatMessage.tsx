"use client";

import type { AiChatMessage } from "@/lib/ai/types";
import { ActionCard } from "./ActionCard";
import { BusinessRiskAssessmentPanel } from "./BusinessRiskAssessmentPanel";
import { CopilotConversationalResponse } from "./CopilotConversationalResponse";
import { MetricPills } from "@/components/MetricPills";
import { getActionCapability } from "@/lib/insights/actions";

function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ChatMessage({
  message,
  onFollowUp,
}: {
  message: AiChatMessage;
  onFollowUp?: (question: string) => void;
}) {
  const isUser = message.role === "user";
  const structured = message.structured;
  const ra = structured?.riskAssessment;
  const conversational = structured?.conversational;

  return (
    <div className={`chat-message ${isUser ? "chat-message-user" : "chat-message-assistant"}`}>
      <div className="chat-bubble">
        {structured && !isUser ? (
          <div className="copilot-response">
            {conversational && !ra ? (
              <CopilotConversationalResponse
                structured={structured}
                onFollowUp={onFollowUp}
              />
            ) : (
              <>
                {structured.title && !ra && (
                  <h3 style={{ margin: "0 0 8px", fontSize: "1.05rem", lineHeight: 1.35 }}>
                    {structured.title}
                  </h3>
                )}
                {!ra && (
                  <p style={{ margin: "0 0 12px", lineHeight: 1.55, fontWeight: 500, whiteSpace: "pre-wrap" }}>
                    {structured.summary}
                  </p>
                )}

                {structured.unlockCapabilities && structured.unlockCapabilities.length > 0 && !ra && (
                  <div style={{ marginBottom: 12 }}>
                    <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
                      What will become available after syncing
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem", lineHeight: 1.5 }}>
                      {structured.unlockCapabilities.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {structured.whyItHappened && !ra && (
                  <div style={{ marginBottom: 12 }}>
                    <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
                      Why it happened
                    </p>
                    <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.55 }}>
                      {structured.whyItHappened}
                    </p>
                  </div>
                )}

                {ra && (
                  <BusinessRiskAssessmentPanel assessment={ra} />
                )}

                {structured.evidence.length > 0 && !ra && (
                  <div style={{ marginBottom: 12 }}>
                    <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
                      Evidence
                    </p>
                    <MetricPills metrics={structured.evidence} />
                  </div>
                )}

                {!ra && !conversational && (
                  <p style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>
                    <strong>Confidence:</strong> {structured.confidencePct}%
                  </p>
                )}

                {structured.recommendations.length > 0 && !ra && !conversational && (
                  <div style={{ marginBottom: 12 }}>
                    <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
                      Recommendation
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.9rem" }}>
                      {structured.recommendations.map((rec, i) => (
                        <li key={`${i}-${rec.action}`} style={{ marginBottom: 6 }}>
                          <strong>{rec.action}</strong> — {rec.detail}
                          {rec.futureAction && (
                            <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>
                              {getActionCapability(rec.futureAction)?.label ?? rec.futureAction}
                              {rec.available ? " · Available" : " · Coming soon"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {structured.futureInsightExamples &&
                  structured.futureInsightExamples.length > 0 &&
                  !ra && (
                    <div style={{ marginBottom: 12 }}>
                      <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
                        After synchronization, ask
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem", lineHeight: 1.5 }}>
                        {structured.futureInsightExamples.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {!conversational && (
                  <div className="revenue-impact-panel" style={{ marginTop: 8 }}>
                    <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
                      {ra ? "Financial Summary" : "Estimated Business Impact"}
                    </p>
                    {structured.businessImpact.calculable ? (
                      <div style={{ fontSize: "0.9rem" }}>
                        {structured.businessImpact.monthlyRevenue != null &&
                          structured.businessImpact.monthlyRevenue > 0 && (
                            <p style={{ margin: "0 0 4px" }}>
                              Est. monthly revenue at risk:{" "}
                              <strong>{formatMoney(structured.businessImpact.monthlyRevenue)}</strong>
                            </p>
                          )}
                        {structured.businessImpact.monthlyProfit != null &&
                          structured.businessImpact.monthlyProfit > 0 && (
                            <p style={{ margin: "0 0 4px" }}>
                              Est. monthly profit/cash impact:{" "}
                              <strong>{formatMoney(structured.businessImpact.monthlyProfit)}</strong>
                            </p>
                          )}
                        {structured.businessImpact.label && (
                          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                            {structured.businessImpact.label}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                        {structured.businessImpact.reasonIfNot ?? structured.businessImpact.label}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="chat-content">
            {message.content.split("\n").map((line, i) => (
              <p key={i} style={{ margin: line === "" ? "0 0 8px" : "0 0 6px", lineHeight: 1.55 }}>
                {renderContent(line)}
              </p>
            ))}
          </div>
        )}

        {message.simulation && (
          <div className="simulation-card">
            <p className="muted" style={{ margin: "0 0 6px", fontWeight: 500 }}>
              Revenue simulation — {message.simulation.scenario}
            </p>
            <p style={{ margin: "0 0 8px" }}>{message.simulation.summary}</p>
            <p className="muted" style={{ margin: "0 0 8px" }}>
              <strong>Impact:</strong> {message.simulation.estimatedImpact}
            </p>
            <MetricPills metrics={message.simulation.metrics} />
            <p className="confidence" style={{ marginTop: 8 }}>
              Confidence: {Math.round(message.simulation.confidence * 100)}%
            </p>
          </div>
        )}

        {message.actionCards && message.actionCards.length > 0 && !structured?.conversational && (
          <div className="action-cards-grid">
            {message.actionCards.map((card) => (
              <ActionCard key={card.recommendationId ?? card.title} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
