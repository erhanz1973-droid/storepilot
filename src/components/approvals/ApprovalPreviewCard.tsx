import type { ApprovalPreview } from "@/lib/approvals/decision-center-types";

export function ApprovalPreviewCard({ preview }: { preview: ApprovalPreview }) {
  return (
    <section className="decision-approval-preview">
      <h5>Approval Preview</h5>
      <p className="muted">You are approving:</p>
      <ul className="decision-approval-preview-list">
        {preview.items.map((item) => (
          <li key={item}>✓ {item}</li>
        ))}
      </ul>
      <p className="decision-approval-preview-footer muted">
        Rollback available anytime.
      </p>
    </section>
  );
}
