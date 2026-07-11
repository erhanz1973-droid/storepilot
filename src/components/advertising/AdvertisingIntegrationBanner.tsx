import Link from "next/link";
import type { IntegrationReadiness } from "@/lib/trust/integration-readiness";

export function AdvertisingIntegrationBanner({ readiness }: { readiness: IntegrationReadiness }) {
  if (!readiness.advertisingMessage && readiness.integrationIssues.length === 0) return null;

  return (
    <div className="card advertising-integration-banner" role="status" style={{ marginBottom: 16 }}>
      {readiness.advertisingMessage ? (
        <p className="muted" style={{ margin: 0 }}>
          {readiness.advertisingMessage}
        </p>
      ) : null}
      {readiness.integrationIssues.map((issue) => (
        <p key={issue.platform} className="exec-advisor-validation-warn" style={{ margin: "8px 0 0" }}>
          {issue.message}
        </p>
      ))}
      {(readiness.phase === "shopify_only" || readiness.disconnectedPlatforms.length > 0) && (
        <p style={{ margin: "12px 0 0" }}>
          <Link href="/connections">Connect advertising platforms</Link>
        </p>
      )}
    </div>
  );
}
