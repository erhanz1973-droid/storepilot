"use client";

import Link from "next/link";
import { useState } from "react";
import type { AnalyticsPageContext } from "@/lib/analytics/types";
import type { ExecutiveAiLiveStatus } from "@/lib/analytics/executive-ai-behavior";
import { ExecutiveAiStatusIndicator } from "@/components/executive/advisor/ExecutiveAiStatusIndicator";
import { DateRangeSelector } from "./DateRangeSelector";
import type { AnalyticsDateRange } from "@/lib/analytics/types";

const ASK_PROMPTS: Record<AnalyticsPageContext, string[]> = {
  executive: [
    "Explain these numbers",
    "What should I do next?",
    "Compare with last week",
    "Show biggest opportunities",
  ],
  marketing: [
    "Which campaigns should I pause?",
    "Compare with Meta",
    "Compare with Google",
    "Why is ROAS falling?",
  ],
  traffic: [
    "Why did traffic change?",
    "Which source converts best?",
    "Compare with last week",
  ],
  sales: [
    "Why did revenue decrease?",
    "What changed this week?",
    "Predict next week's revenue",
  ],
  products: [
    "Which products deserve more budget?",
    "Show worst conversion products",
    "What bundle should I create?",
  ],
  customers: [
    "How can I improve repeat rate?",
    "Who are my top customers?",
  ],
  funnel: [
    "Why are users abandoning cart?",
    "What should I fix first?",
  ],
  inventory: [
    "What should I restock?",
    "Which dead inventory to clear?",
  ],
  profit: [
    "Explain profit margin",
    "Where am I losing money?",
    "Compare with last week",
  ],
  attribution: [
    "Which channel drives profit?",
    "Compare attribution models",
  ],
  advertising: [
    "Which campaigns are losing money?",
    "Where should I move my budget?",
    "Which creatives should I replace?",
    "What should I do first today?",
  ],
  insights: [
    "Highlight biggest opportunity",
    "Highlight biggest risk",
    "What changed this week?",
  ],
  live: [
    "What's happening right now?",
    "Is today on track?",
  ],
};

type Props = {
  title: string;
  description?: string;
  context: AnalyticsPageContext;
  syncedAt?: string;
  children: React.ReactNode;
  /** Client wrapper passes date range state */
  showDateRange?: boolean;
  headerExtra?: React.ReactNode;
  /** Pass serializable status from RSC — indicator renders inside this client shell */
  executiveAiStatus?: ExecutiveAiLiveStatus;
};

export function AnalyticsPageShell({
  title,
  description,
  context,
  syncedAt,
  children,
  showDateRange = true,
  headerExtra,
  executiveAiStatus,
}: Props) {
  const [range, setRange] = useState<AnalyticsDateRange>("last30d");
  const [askOpen, setAskOpen] = useState(false);
  const prompts = ASK_PROMPTS[context];

  return (
    <div className="analytics-page">
      <header className="analytics-page-header">
        <div className="analytics-page-header-main">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
          {syncedAt && (
            <p className="analytics-synced muted">
              Last synced {new Date(syncedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="analytics-page-header-actions">
          {executiveAiStatus ? (
            <ExecutiveAiStatusIndicator
              status={executiveAiStatus}
              compact={context === "executive"}
            />
          ) : (
            headerExtra
          )}
          <div className="analytics-ask-ai-wrap">
            <button
              type="button"
              className="btn btn-primary analytics-ask-btn"
              onClick={() => setAskOpen((o) => !o)}
            >
              Ask AI
            </button>
            {askOpen && (
              <div className="analytics-ask-menu card">
                <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
                  AI uses this page as context
                </p>
                {prompts.map((prompt) => (
                  <Link
                    key={prompt}
                    href={`/ask-ai?q=${encodeURIComponent(prompt)}&ctx=${context}`}
                    className="analytics-ask-item"
                    onClick={() => setAskOpen(false)}
                  >
                    {prompt}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {showDateRange && (
        <DateRangeSelector value={range} onChange={setRange} />
      )}

      <div className="analytics-page-body">{children}</div>
    </div>
  );
}
