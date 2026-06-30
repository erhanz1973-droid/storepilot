import { describe, expect, it } from "vitest";
import { detectCopilotIntent, resolveFollowUpIntent, INTENT_DATA_SOURCES } from "@/lib/copilot/intents";
import { getCopilotSession, recordCopilotTurn } from "@/lib/copilot/session";
import { formatCopilotMessage } from "@/lib/copilot/response";
import type { CopilotStructuredResponse } from "@/lib/copilot/types";

describe("AI Copilot", () => {
  it("detects copilot intents", () => {
    expect(detectCopilotIntent("Why did sales decrease yesterday?")).toBe("sales_yesterday");
    expect(detectCopilotIntent("Which campaigns should I pause?")).toBe("pause_campaigns");
    expect(detectCopilotIntent("What should I do today?")).toBe("today");
    expect(detectCopilotIntent("Show my biggest opportunities")).toBe("biggest_opportunities");
    expect(detectCopilotIntent("Why is ROAS decreasing?")).toBe("roas_decrease");
    expect(detectCopilotIntent("Explain my Store Health Score")).toBe("store_health_explain");
    expect(detectCopilotIntent("Who are my top customers?")).toBe("customer_top");
    expect(detectCopilotIntent("What is customer LTV?")).toBe("customer_intelligence");
    expect(detectCopilotIntent("Which products are best sellers?")).toBe("product_intelligence");
    expect(detectCopilotIntent("Show dead inventory")).toBe("inventory_intelligence");
    expect(detectCopilotIntent("How is Meta ads performing?")).toBe("marketing_intelligence");
  });

  it("routes customer page context to customer intelligence", () => {
    expect(detectCopilotIntent("How can I improve repeat rate?", "customers")).toBe(
      "customer_intelligence",
    );
  });

  it("resolves follow-up questions from session context", () => {
    const sessionId = crypto.randomUUID();
    recordCopilotTurn(sessionId, {
      userQuestion: "Why did ROAS decrease?",
      assistantSummary: "ROAS declined",
      intent: "roas_decrease",
    });

    const session = getCopilotSession(sessionId);
    const followUp = resolveFollowUpIntent("Compare with Meta", session.lastIntent);
    expect(followUp.intent).toBe("roas_meta_compare");

    const weekFollowUp = resolveFollowUpIntent("What about last week?", "roas_decrease");
    expect(weekFollowUp.intent).toBe("roas_decrease");
  });

  it("maps intents to selective data sources", () => {
    expect(INTENT_DATA_SOURCES.roas_decrease).toContain("google_ads");
    expect(INTENT_DATA_SOURCES.roas_decrease).toContain("meta_ads");
    expect(INTENT_DATA_SOURCES.restock).toContain("shopify");
    expect(INTENT_DATA_SOURCES.today).toEqual(["all"]);
  });

  it("formats structured response with evidence and confidence", () => {
    const structured: CopilotStructuredResponse = {
      title: "Sales decreased yesterday",
      summary: "Sales decreased yesterday because Google conversions fell 18%.",
      evidence: [
        { label: "Google conversions", value: "-18%", trend: "down" },
        { label: "Meta CPM", value: "+21%", trend: "up" },
      ],
      confidencePct: 92,
      recommendations: [
        {
          action: "Pause Campaign A",
          detail: "Zero conversions in 9 days",
          futureAction: "pause_campaign",
          available: false,
        },
      ],
      businessImpact: {
        monthlyProfit: 820,
        label: "+$820/mo profit",
        calculable: true,
      },
      relatedInsights: [],
      dataSourcesUsed: ["google_ads", "meta_ads"],
      intent: "sales_yesterday",
    };

    const formatted = formatCopilotMessage(structured);
    expect(formatted).toContain("92%");
    expect(formatted).toContain("Google conversions");
    expect(formatted).toContain("$820");
    expect(formatted).toContain("Pause Campaign A");
  });
});
