import Link from "next/link";
import { CrossModuleReference } from "@/components/executive/CrossModuleReference";
import type { CfoDecision } from "@/lib/profit/profit-page-view";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ProfitCfoDecisionCard({ decision }: { decision: CfoDecision }) {
  return (
    <section className="card profit-cfo-decision">
      <h3 style={{ marginTop: 0 }}>{decision.title}</h3>
      <div className="profit-cfo-decision-body">
        {decision.lines.map((line) => (
          <p key={line} className="profit-cfo-decision-line">
            {line}
          </p>
        ))}
      </div>
      <div className="profit-cfo-decision-metrics">
        {decision.expectedMonthlyRecovery > 0 && (
          <div>
            <span className="muted">Expected Monthly Profit Recovery</span>
            <strong className="positive">+{formatMoney(decision.expectedMonthlyRecovery)}</strong>
          </div>
        )}
        <div>
          <span className="muted">Confidence</span>
          <strong>{decision.confidence}</strong>
        </div>
      </div>
      <Link href={decision.approvalHref} className="btn btn-primary btn-sm">
        Send to Approval Center
      </Link>
      <CrossModuleReference
        message="Advertising may be your largest financial leak — review campaign recommendations."
        targetModule="marketing"
        linkLabel="Review Marketing Recommendations"
      />
    </section>
  );
}
