import type { FeedbackReportStatus } from "@/lib/feedback/types";
import { FEEDBACK_STATUS_LABELS } from "@/lib/feedback/constants";

export function FeedbackStatusBadge({ status }: { status: FeedbackReportStatus }) {
  return <span className={`fb-status fb-status-${status}`}>{FEEDBACK_STATUS_LABELS[status]}</span>;
}
