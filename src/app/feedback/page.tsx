import { FeedbackCenterClient } from "@/components/feedback/FeedbackCenterClient";
import { buildFeedbackCenterView } from "@/lib/db/feedback-center";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const view = await buildFeedbackCenterView();

  return (
    <>
      <div className="page-header">
        <h2>Feedback Center</h2>
        <p>
          Report bugs, rate AI recommendations, request features, and help improve StorePilot.
          Context is captured automatically — no external forms required.
        </p>
      </div>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <FeedbackCenterClient initial={view} />
      </Suspense>
    </>
  );
}
