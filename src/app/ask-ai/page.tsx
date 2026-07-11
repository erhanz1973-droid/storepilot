import { AskAiChatLauncher } from "@/components/ask-ai/AskAiChatLauncher";
import { DailyActionsPanel } from "@/components/actions/DailyActionsPanel";
import { buildAskAiPageData } from "@/lib/services/dashboard";
import Link from "next/link";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function AskAiPage() {
  const { decisions } = await buildAskAiPageData();

  return (
    <>
      <div className="page-header">
        <h2>AI Copilot</h2>
        <p>
          Your daily AI operations manager. Prioritized actions come first — ask follow-up questions
          in the chat below.
        </p>
      </div>

      <DailyActionsPanel items={decisions} limit={6} />

      <p className="muted" style={{ margin: "16px 0", fontSize: "0.9rem" }}>
        <Link href="/decisions">Manage all decisions</Link> · approve, reject, or defer actions
      </p>

      <Suspense fallback={null}>
        <AskAiChatLauncher />
      </Suspense>
    </>
  );
}
