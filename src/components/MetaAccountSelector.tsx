"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TopLevelOAuthLink } from "@/components/connections/TopLevelOAuthLink";
import { redirectTop } from "@/lib/shopify/embedded-navigation";

type AdAccount = { id: string; name: string; accountStatus?: number };
type Business = { id: string; name: string; adAccounts: AdAccount[] };

type AccountOption = {
  businessId: string;
  businessName: string;
  account: AdAccount;
};

function formatAccountStatus(status?: number): string | null {
  if (status == null) return null;
  if (status === 1) return "Aktif";
  if (status === 2) return "Devre dışı";
  if (status === 3) return "Ödenmemiş";
  if (status === 7) return "Beklemede";
  if (status === 9) return "Kapatılıyor";
  return `Durum ${status}`;
}

export function MetaAccountSelector({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metaUserName, setMetaUserName] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/meta/accounts/options?session=${sessionId}`);
        const data = (await res.json()) as {
          error?: string;
          metaUserName?: string;
          businesses?: Business[];
        };
        if (!res.ok) throw new Error(data.error ?? "Hesaplar yüklenemedi");
        setMetaUserName(data.metaUserName ?? null);
        setBusinesses(data.businesses ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hesaplar yüklenemedi");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  const options = useMemo<AccountOption[]>(() => {
    const rows: AccountOption[] = [];
    for (const business of businesses) {
      for (const account of business.adAccounts) {
        rows.push({
          businessId: business.id,
          businessName: business.name,
          account,
        });
      }
    }
    return rows;
  }, [businesses]);

  const selected = options.find(
    (row) => `${row.businessId}:${row.account.id}` === selectedKey,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/meta/accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          businessId: selected.businessId,
          businessName: selected.businessName,
          adAccountId: selected.account.id,
          adAccountName: selected.account.name,
        }),
      });
      const data = (await res.json()) as { error?: string; redirectUrl?: string };
      if (!res.ok) throw new Error(data.error ?? "Bağlantı başarısız");
      redirectTop(data.redirectUrl ?? "/connections?tab=advertising&meta_connected=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bağlantı başarısız");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="muted">Business Manager ve reklam hesapları yükleniyor…</p>;
  }

  if (error && options.length === 0) {
    return (
      <div className="stack">
        <p className="empty-state">{error}</p>
        <TopLevelOAuthLink
          href="/api/meta/auth"
          className="btn btn-secondary"
          style={{ alignSelf: "flex-start" }}
        >
          Tekrar bağlan
        </TopLevelOAuthLink>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}>
          Bu Meta kullanıcısı için erişilebilir reklam hesabı bulunamadı. Business Manager veya ad
          account izinlerini kontrol edin.
        </p>
        <Link href="/connections?tab=advertising" className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>
          Connections’a dön
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      {metaUserName && (
        <p className="muted" style={{ margin: 0 }}>
          Giriş: <strong>{metaUserName}</strong>
        </p>
      )}

      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        {businesses.length} Business Manager · {options.length} reklam hesabı
      </p>

      <div className="meta-account-picker">
        {businesses.map((business) => (
          <section key={business.id} className="meta-account-business">
            <h4 className="meta-account-business-title">{business.name}</h4>
            <p className="muted meta-account-business-id">ID: {business.id}</p>
            <ul className="meta-account-list">
              {business.adAccounts.map((account) => {
                const key = `${business.id}:${account.id}`;
                const statusLabel = formatAccountStatus(account.accountStatus);
                return (
                  <li key={key}>
                    <label className={`meta-account-option ${selectedKey === key ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="meta-ad-account"
                        value={key}
                        checked={selectedKey === key}
                        onChange={() => setSelectedKey(key)}
                      />
                      <span className="meta-account-option-body">
                        <strong>{account.name}</strong>
                        <span className="muted">
                          {account.id}
                          {statusLabel ? ` · ${statusLabel}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {error && <p style={{ color: "var(--critical)", margin: 0 }}>{error}</p>}

      <div className="actions-row">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !selected}
        >
          {submitting ? "Kaydediliyor…" : "Seçili hesabı bağla"}
        </button>
        <Link href="/connections?tab=advertising" className="btn btn-ghost">
          İptal
        </Link>
      </div>
    </form>
  );
}
