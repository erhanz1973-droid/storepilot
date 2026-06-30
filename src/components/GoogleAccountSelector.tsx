"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type GoogleCustomer = { id: string; name: string };

export function GoogleAccountSelector({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [customers, setCustomers] = useState<GoogleCustomer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/google/accounts/options?session=${sessionId}`);
        const data = (await res.json()) as {
          error?: string;
          googleUserEmail?: string;
          customers?: GoogleCustomer[];
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load accounts");
        setGoogleUserEmail(data.googleUserEmail ?? null);
        setCustomers(data.customers ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Google Ads accounts");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  function toggleCustomer(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) return;

    setSubmitting(true);
    setError(null);

    const chosen = customers.filter((c) => selected.has(c.id));

    try {
      const res = await fetch("/api/google/accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, customers: chosen }),
      });
      const data = (await res.json()) as { error?: string; redirectUrl?: string };
      if (!res.ok) throw new Error(data.error ?? "Connection failed");
      router.push(data.redirectUrl ?? "/connections?google_connected=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="muted">Loading your Google Ads accounts…</p>;
  }

  if (error && customers.length === 0) {
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
        <p className="muted" style={{ margin: "0 0 8px" }}>
          Select one or more Google Ads customer accounts
        </p>
        <div className="stack">
          {customers.map((customer) => (
            <label
              key={customer.id}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={selected.has(customer.id)}
                onChange={() => toggleCustomer(customer.id)}
              />
              <span>
                {customer.name}{" "}
                <span className="muted">({customer.id})</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "var(--critical)", margin: 0 }}>{error}</p>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitting || selected.size === 0}
        style={{ alignSelf: "flex-start" }}
      >
        {submitting ? "Connecting…" : `Connect ${selected.size} account(s)`}
      </button>
    </form>
  );
}
