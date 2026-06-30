"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Ga4AccountSummary } from "@/lib/ga4/api";

export function Ga4PropertySelector({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Ga4AccountSummary[]>([]);
  const [accountId, setAccountId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/ga4/accounts/options?session=${sessionId}`);
        const data = (await res.json()) as {
          error?: string;
          googleUserEmail?: string;
          accounts?: Ga4AccountSummary[];
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load GA4 accounts");
        setGoogleUserEmail(data.googleUserEmail ?? null);
        setAccounts(data.accounts ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load GA4 accounts");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  const selectedAccount = accounts.find((a) => a.accountId === accountId);
  const selectedProperty = selectedAccount?.properties.find((p) => p.propertyId === propertyId);
  const selectedStream = selectedProperty?.dataStreams.find((s) => s.streamId === streamId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !propertyId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/ga4/accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          accountId,
          accountName: selectedAccount?.accountName,
          propertyId,
          propertyName: selectedProperty?.propertyName,
          dataStreamId: streamId || undefined,
          dataStreamName: selectedStream?.streamName,
          measurementId: selectedStream?.measurementId,
        }),
      });
      const data = (await res.json()) as { error?: string; redirectUrl?: string };
      if (!res.ok) throw new Error(data.error ?? "Connection failed");
      router.push(data.redirectUrl ?? "/connections?ga4_connected=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="muted">Loading your Google Analytics accounts…</p>;
  }

  if (error && accounts.length === 0) {
    return <p className="empty-state">{error}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      {googleUserEmail && (
        <p className="muted" style={{ margin: 0 }}>
          Signed in as <strong>{googleUserEmail}</strong>
        </p>
      )}

      <div>
        <label className="muted" style={{ display: "block", marginBottom: 8 }}>
          GA4 Account
        </label>
        <select
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            setPropertyId("");
            setStreamId("");
          }}
          required
          style={{ width: "100%", maxWidth: 480 }}
        >
          <option value="">Select account…</option>
          {accounts.map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {account.accountName} ({account.accountId})
            </option>
          ))}
        </select>
      </div>

      {selectedAccount && (
        <div>
          <label className="muted" style={{ display: "block", marginBottom: 8 }}>
            GA4 Property
          </label>
          <select
            value={propertyId}
            onChange={(e) => {
              setPropertyId(e.target.value);
              setStreamId("");
            }}
            required
            style={{ width: "100%", maxWidth: 480 }}
          >
            <option value="">Select property…</option>
            {selectedAccount.properties.map((property) => (
              <option key={property.propertyId} value={property.propertyId}>
                {property.propertyName} ({property.propertyId})
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedProperty && selectedProperty.dataStreams.length > 0 && (
        <div>
          <label className="muted" style={{ display: "block", marginBottom: 8 }}>
            Data stream (optional)
          </label>
          <select
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            style={{ width: "100%", maxWidth: 480 }}
          >
            <option value="">All streams for this property</option>
            {selectedProperty.dataStreams.map((stream) => (
              <option key={stream.streamId} value={stream.streamId}>
                {stream.streamName}
                {stream.measurementId ? ` · ${stream.measurementId}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p style={{ color: "var(--critical)", margin: 0 }}>{error}</p>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitting || !accountId || !propertyId}
        style={{ alignSelf: "flex-start" }}
      >
        {submitting ? "Connecting…" : "Connect property"}
      </button>
    </form>
  );
}
