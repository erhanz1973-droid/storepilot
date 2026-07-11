import type { AiTrackRecord } from "@/lib/approvals/decision-center-types";
import { MetricInfo } from "./MetricInfo";

export function AiTrackRecordCard({ record }: { record: AiTrackRecord }) {
  if (!record.hasSufficientData) {
    return (
      <section className="decision-track-record card is-empty">
        <h5>AI Track Record</h5>
        <p className="decision-track-record-empty-title">Not enough historical decisions yet.</p>
        <p className="muted decision-track-record-empty-copy">
          Complete more AI recommendations to unlock personalized performance analytics.
        </p>
      </section>
    );
  }

  return (
    <section className="decision-track-record card">
      <h5>
        AI Track Record
        {record.isDemoData && <span className="decision-track-record-demo-badge">Demo data</span>}
      </h5>
      <dl className="decision-track-record-grid">
        <div>
          <dt>Approved Decisions</dt>
          <dd>{record.approvedDecisions}</dd>
        </div>
        <div>
          <dt>Successful</dt>
          <dd>{record.successful}</dd>
        </div>
        <div>
          <dt>Success Rate</dt>
          <dd>{record.successRatePct}%</dd>
        </div>
        <div>
          <dt>
            Avg Monthly Profit Increase <MetricInfo metricKey="estimated_profit" />
          </dt>
          <dd className="decision-exec-positive">
            +${record.avgMonthlyProfitIncrease.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt>
            Avg Confidence <MetricInfo metricKey="confidence" />
          </dt>
          <dd>{record.avgConfidencePct}%</dd>
        </div>
        <div>
          <dt>False Positives</dt>
          <dd>{record.falsePositivePct}%</dd>
        </div>
      </dl>
    </section>
  );
}
