# Source Traceability (Phase 3)

Every displayed value must flow from a single aggregation path. No surface may invent its own number for the same metric.

## Revenue trace

```
Shopify GraphQL (orders.totalPriceSet)
        ↓
lib/shopify/sync.ts → storeMetrics.revenue30d
        ↓
lib/connectors/registry.ts → aggregateStoreSnapshot
        ↓
lib/profit/engine.ts → profitRollups → primary.revenue
        ↓
┌───────────────────┬────────────────────┬─────────────────────┐
│ Executive dashboard│ Profit page        │ Reports briefing    │
│ analytics/executive│ services/profit    │ reports/build-weekly│
└───────────────────┴────────────────────┴─────────────────────┘
        ↓
ReportExportBar (CSV/PDF) — same JSON from buildReportsPageData()
```

**Consistency rule:** `reports.executive.revenue` MUST equal `profitDashboard.primary.revenue` OR `storeMetrics.revenue30d` for the same sync timestamp.

## Net profit trace

```
Shopify orders + costs + refunds
        ↓
profitRollups (per window)
        ↓
+ Meta/Google spend from sync cache
        ↓
lib/profit/engine.ts → primary.netProfit
        ↓
Executive / Profit / Reports / Live (today bucket)
```

## Ad spend trace

```
Meta Graph API / Google GAQL
        ↓
lib/meta/store-sync.ts / lib/google-ads/store-sync.ts → DB cache
        ↓
lib/connectors/plugins/* → snapshot.campaigns / googleAdsSnapshot
        ↓
lib/ads/spend.ts → adSpendSnapshot.totalRollups
        ↓
Executive, Marketing, ROAS, Profit engine
```

## Blended ROAS trace

```
storeMetrics.revenue (Shopify) + adSpendSnapshot (Meta+Google)
        ↓
lib/profit/roas.ts → computeBlendedRoasDashboard
        ↓
Executive KPI, Profit page, Reports scorecard
```

## AI / Reports-only metrics

| Metric | Source | Not duplicated elsewhere |
|--------|--------|--------------------------|
| AI outcomes (generated/approved/completed) | `intelligence` DB + `weeklyReport` | Reports only |
| Learning timeline | `activityFeed` + `outcomeRecords` | Reports only |
| Next week plan | `decisionCenter` + `executive-experience` | Reports + Decisions |

## Verification

1. Note `syncedAt` on Executive and Reports — must match.
2. Compare revenue and net profit across Executive, Profit, Reports in one session.
3. Log discrepancies in [CROSS_VALIDATION.md](./CROSS_VALIDATION.md).

## Code entry points

| Layer | File |
|-------|------|
| Snapshot aggregation | `lib/connectors/registry.ts` |
| Dashboard hub | `lib/services/dashboard.ts` |
| Analytics pages | `lib/services/analytics.ts` |
| Reports | `lib/services/reports.ts` |
| Metric registry | `lib/validation/metric-registry.ts` |
