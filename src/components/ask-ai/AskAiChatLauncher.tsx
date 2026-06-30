"use client";

import { useSearchParams } from "next/navigation";
import { AskAiChat } from "./AskAiChat";

export function AskAiChatLauncher() {
  const searchParams = useSearchParams();
  const prefillQuestion = searchParams.get("q") ?? undefined;
  const pageContext = searchParams.get("ctx") ?? undefined;
  const recommendationTitle = searchParams.get("rec") ?? undefined;
  const recommendationId = searchParams.get("recommendationId") ?? undefined;
  const decisionId = searchParams.get("decisionId") ?? undefined;

  return (
    <AskAiChat
      prefillQuestion={prefillQuestion}
      pageContext={pageContext}
      recommendationTitle={recommendationTitle}
      recommendationId={recommendationId}
      decisionId={decisionId}
    />
  );
}
