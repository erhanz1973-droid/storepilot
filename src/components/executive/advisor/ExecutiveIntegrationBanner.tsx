import Link from "next/link";
import type { IntegrationReadiness } from "@/lib/trust/integration-readiness";

export function ExecutiveIntegrationBanner({ readiness }: { readiness: IntegrationReadiness }) {
  const messages = [
    readiness.executiveMessage,
    ...readiness.integrationIssues.map((i) => i.message),
    readiness.dataConfidence === "low" ? readiness.dataConfidenceMessage : null,
  ].filter(Boolean) as string[];

  if (messages.length === 0) return null;

  const showConnect =
    readiness.phase === "shopify_only" ||
    readiness.phase === "fresh_store" ||
    readiness.disconnectedPlatforms.length > 0;

  return (
    <div className="exec-advisor-integration-banner card" role="status">
      {messages.map((message) => (
        <p key={message} className="exec-advisor-integration-copy">
          {message}
        </p>
      ))}
      {showConnect && (
        <p style={{ margin: "12px 0 0" }}>
          <Link href="/first-run" className="btn btn-primary">
            Continue first-run briefing
          </Link>{" "}
          <Link href="/connections" className="btn btn-secondary">
            Open Connections
          </Link>
          {readiness.phase === "fresh_store" || readiness.phase === "shopify_only" ? (
            <>
              {" "}
              <Link href="/onboarding" className="btn btn-ghost">
                Full setup guide
              </Link>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
