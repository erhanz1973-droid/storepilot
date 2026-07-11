import type { AiEvidence, AiEvidenceStrength } from "@/lib/analytics/executive-advisor";

function strengthClass(strength: AiEvidenceStrength): string {
  if (strength === "Strong") return "exec-evidence-strong";
  if (strength === "Moderate") return "exec-evidence-moderate";
  return "exec-evidence-limited";
}

export function EvidenceStrengthBadge({
  evidence,
  showExplanation = false,
}: {
  evidence: AiEvidence;
  showExplanation?: boolean;
}) {
  return (
    <div className="exec-evidence-badge-wrap">
      <span className={`exec-evidence-badge ${strengthClass(evidence.strength)}`}>
        {evidence.strength}
      </span>
      {showExplanation && (
        <p className="muted exec-evidence-explanation">{evidence.explanation}</p>
      )}
    </div>
  );
}
