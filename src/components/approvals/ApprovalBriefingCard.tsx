import type { ApprovalPresentation } from "@/lib/approvals/presenter";

export function ApprovalBriefingCard({
  presentation,
}: {
  presentation: ApprovalPresentation;
}) {
  return (
    <div className="card approval-briefing-card">
      <h3>{presentation.hasActionableOpportunities ? "AI Summary" : "AI Briefing"}</h3>
      <div className="approval-briefing-body">
        {presentation.aiSummaryLines.map((line) => (
          <p key={line} style={{ margin: "0 0 10px", lineHeight: 1.55 }}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
