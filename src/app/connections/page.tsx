import { Suspense } from "react";
import { ConnectionsWorkspace } from "@/components/connections/ConnectionsWorkspace";
import { buildIntegrationBoard } from "@/lib/connections/integration-board";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    google_connected?: string;
    ga4_connected?: string;
    meta_connected?: string;
    installed?: string;
    error?: string;
    tab?: string;
  }>;
}) {
  const params = await searchParams;
  const board = await buildIntegrationBoard();

  return (
    <>
      <div className="page-header">
        <h2>Connections</h2>
        <p>
          Which platforms are connected, and are they working correctly? Connect your store, ads,
          analytics, and business systems — all in one place.
        </p>
      </div>

      {params.installed === "1" && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--low)" }}>
          <p style={{ margin: 0 }}>Store connected successfully.</p>
        </div>
      )}

      {params.google_connected === "1" && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--low)" }}>
          <p style={{ margin: 0 }}>Google Ads connected successfully.</p>
        </div>
      )}

      {params.ga4_connected === "1" && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--low)" }}>
          <p style={{ margin: 0 }}>Google Analytics 4 connected successfully.</p>
        </div>
      )}

      {params.meta_connected === "1" && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--low)" }}>
          <p style={{ margin: 0 }}>Meta Ads connected successfully.</p>
        </div>
      )}

      {params.error && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--critical)" }}>
          <p style={{ margin: 0 }}>
            {params.error === "invalid_state" ? (
              <>
                Connection error: OAuth session could not be verified (invalid_state).
                Open the app at the same URL you use in <code>GOOGLE_ADS_APP_URL</code> (e.g.{" "}
                <code>http://localhost:3002</code>), add that URL&apos;s callback{" "}
                <code>/api/google/callback</code> in Google Cloud Console → OAuth redirect URIs,
                then connect again in a single browser tab.
              </>
            ) : params.error.includes("ga4_oauth_pending") ||
              params.error.includes("ga4_installations") ||
              params.error.includes("does not exist") ? (
              <>
                Connection error: GA4 database tables are missing. Run Supabase migration{" "}
                <code>20260711120000_ga4_oauth.sql</code>, then try connecting again.
              </>
            ) : (
              <>Connection error: {decodeURIComponent(params.error)}</>
            )}
          </p>
        </div>
      )}

      <Suspense fallback={<div className="card muted">Loading connections…</div>}>
        <ConnectionsWorkspace payload={board} />
      </Suspense>
    </>
  );
}
