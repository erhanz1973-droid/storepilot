import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { ExecutiveInsightsPanel } from "@/components/insights/ExecutiveInsightsPanel";
import { buildExecutiveInsightsPageData } from "@/lib/services/executive-insights";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const { dashboard, brief } = await buildExecutiveInsightsPageData();

  return (
    <AnalyticsPageShell
      title="AI Insights"
      description="Executive summary of every AI recommendation across StorePilot — one business, one source of truth."
      context="insights"
      syncedAt={dashboard.lastAnalyzedAt}
      showDateRange={false}
    >
      <div className="analytics-insights-prompts card">
        <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.85rem" }}>
          Ask StorePilot
        </p>
        <div className="analytics-insights-chips">
          {[
            "Which campaigns should I pause?",
            "What is losing money?",
            "What should I do first?",
          ].map((q) => (
            <Link key={q} href={`/ask-ai?q=${encodeURIComponent(q)}&ctx=insights`} className="analytics-chip">
              {q}
            </Link>
          ))}
        </div>
      </div>

      <ExecutiveInsightsPanel brief={brief} />

      <p className="muted" style={{ marginTop: 16, fontSize: "0.875rem" }}>
        Recommendations are sourced from{" "}
        <Link href="/analytics/attribution">Attribution</Link>,{" "}
        <Link href="/analytics/profit">Profit</Link>,{" "}
        <Link href="/analytics/products">Products</Link>,{" "}
        <Link href="/analytics/customers">Customers</Link>, and{" "}
        <Link href="/analytics/inventory">Inventory</Link>.{" "}
        <Link href="/decisions">Open Decisions</Link> for approval workflow detail.
      </p>
    </AnalyticsPageShell>
  );
}
