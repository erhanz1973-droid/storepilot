import { Ga4PropertySelector } from "@/components/Ga4PropertySelector";
import { TopLevelOAuthLink } from "@/components/connections/TopLevelOAuthLink";

export const dynamic = "force-dynamic";

export default async function Ga4PropertySelectPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session;

  if (!sessionId) {
    return (
      <>
        <div className="page-header">
          <h2>Select GA4 Property</h2>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Missing OAuth session.{" "}
            <TopLevelOAuthLink href="/api/ga4/auth">Restart GA4 connection</TopLevelOAuthLink>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>Select GA4 Property</h2>
        <p>Choose the Google Analytics 4 property and data stream StorePilot should analyze.</p>
      </div>
      <div className="card">
        <Ga4PropertySelector sessionId={sessionId} />
      </div>
    </>
  );
}
