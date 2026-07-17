import { GoogleAccountSelector } from "@/components/GoogleAccountSelector";
import { TopLevelOAuthLink } from "@/components/connections/TopLevelOAuthLink";

export const dynamic = "force-dynamic";

export default async function GoogleAccountSelectPage({
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
          <h2>Select Google Ads Accounts</h2>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Missing OAuth session.{" "}
            <TopLevelOAuthLink href="/api/google/auth">Restart Google Ads connection</TopLevelOAuthLink>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>Select Google Ads Accounts</h2>
        <p>Choose which customer accounts StorePilot should analyze.</p>
      </div>
      <div className="card">
        <GoogleAccountSelector sessionId={sessionId} />
      </div>
    </>
  );
}
