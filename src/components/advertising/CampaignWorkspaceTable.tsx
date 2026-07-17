"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdvertisingCampaignRow,
  AdvertisingSortKey,
  TimelineEntry,
} from "@/lib/advertising/types";
import type { CampaignEntitlements } from "@/lib/billing/types";
import { HEALTH_TIER_LABELS } from "@/lib/advertising/types";
import { filterCampaigns, sortCampaigns } from "@/lib/advertising/build-workspace";
import { formatRoas } from "@/lib/attribution/format-roas";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const TREND_ICON = { up: "↑", down: "↓", flat: "→" } as const;

const SORT_OPTIONS: { id: AdvertisingSortKey; label: string }[] = [
  { id: "profit", label: "Profit" },
  { id: "roas", label: "ROAS" },
  { id: "health", label: "Health" },
  { id: "spend", label: "Spend" },
  { id: "trend", label: "Trend" },
  { id: "risk", label: "Risk" },
  { id: "opportunity", label: "Opportunity" },
];

type Props = {
  campaigns: AdvertisingCampaignRow[];
  timelines: TimelineEntry[];
  planUsage?: CampaignEntitlements;
};

export function CampaignWorkspaceTable({ campaigns, timelines: _timelines, planUsage: _planUsage }: Props) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<AdvertisingSortKey>("profit");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [healthTier, setHealthTier] = useState("all");
  const [profitability, setProfitability] = useState("all");

  const filtered = useMemo(() => {
    const f = filterCampaigns(campaigns, { platform, healthTier, profitability, search });
    return sortCampaigns(f, sortKey);
  }, [campaigns, sortKey, platform, healthTier, profitability, search]);

  function handleRowClick(c: AdvertisingCampaignRow) {
    router.push(`/advertising/campaigns/${c.id}`);
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>All campaigns — account scan</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
        Every campaign includes health, profitability, recommendations, creatives, timelines, and simulations.
      </p>

      <div className="adv-filters">
        <input
          type="search"
          placeholder="Search campaigns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="adv-search"
        />
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All Platforms</option>
          <option value="meta">Meta Ads</option>
          <option value="google">Google Ads</option>
          <option value="tiktok">TikTok Ads</option>
          <option value="pinterest">Pinterest</option>
          <option value="microsoft">Microsoft Ads</option>
        </select>
        <select value={healthTier} onChange={(e) => setHealthTier(e.target.value)}>
          <option value="all">All Health</option>
          <option value="excellent">Excellent</option>
          <option value="healthy">Healthy</option>
          <option value="needs_review">Needs Review</option>
          <option value="weak">Weak</option>
          <option value="critical">Critical</option>
        </select>
        <select value={profitability} onChange={(e) => setProfitability(e.target.value)}>
          <option value="all">All Profitability</option>
          <option value="profitable">Profitable</option>
          <option value="unprofitable">Unprofitable</option>
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as AdvertisingSortKey)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>Sort: {o.label}</option>
          ))}
        </select>
      </div>

      <div className="adv-table-wrap">
        <table className="adv-campaign-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Campaign</th>
              <th>Health</th>
              <th>Spend</th>
              <th>Profit</th>
              <th>ROAS</th>
              <th>CTR</th>
              <th>Trend</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const overviewOnly = c.analysisStatus === "overview";
              return (
              <tr
                key={c.id}
                className={`adv-row-clickable ${overviewOnly ? "adv-row-overview" : ""}`}
                onClick={() => handleRowClick(c)}
              >
                <td><span className="adv-priority-rank">{c.priorityRank}</span></td>
                <td>
                  <strong>{c.campaign}</strong>
                  <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>
                    {c.platformLabel}
                  </span>
                  {overviewOnly ? (
                    <span className="adv-overview-label">Overview · open workspace →</span>
                  ) : (
                    <span className="adv-unlock-label">Deep analysis · open workspace →</span>
                  )}
                </td>
                <td>
                  <span className={`adv-health-pill adv-tier-${c.healthTier}`}>
                    {c.healthScore}
                  </span>
                  <span className="muted" style={{ fontSize: "0.75rem", display: "block" }}>
                    {HEALTH_TIER_LABELS[c.healthTier]}
                  </span>
                </td>
                <td>{fmt(c.spend)}</td>
                <td className={c.profit < 0 ? "negative" : "positive"}>{fmt(c.profit)}</td>
                <td>{formatRoas(c.roas)}</td>
                <td>{c.ctr.toFixed(2)}%</td>
                <td><span className={`adv-trend adv-trend-${c.trend}`}>{TREND_ICON[c.trend]}</span></td>
                <td>
                  <span className="adv-brief-rec">{c.briefRecommendation}</span>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="muted" style={{ padding: "16px", margin: 0 }}>No campaigns match your filters.</p>
        )}
      </div>
    </div>
  );
}
