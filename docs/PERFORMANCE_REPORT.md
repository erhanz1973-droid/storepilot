# Performance Optimization Report

**Date:** June 28, 2026  
**Scope:** StorePilot AI dashboard (`storepilot-ai/`)

## Targets

| Metric | Target |
|--------|--------|
| Initial page load | < 2s |
| Navigation between pages | < 300ms perceived |
| Dashboard interactions | Immediate |

---

## Root Causes (Before)

| Bottleneck | Impact |
|------------|--------|
| `buildAnalyticsContext()` called full `buildDashboard()` + separate `aggregateStoreSnapshot()` + `buildProfitDashboard()` — **3× connector aggregation per request** | High — every heavy page |
| Traffic, Sales, Live, Funnel used full analytics context including recommendation sync | High — unnecessary work |
| Profit page fetched data twice (page shell + `ProfitAnalyticsContent`) | Medium |
| Attribution page fetched data twice | Medium |
| Reports page ran 4 parallel snapshot/profit/dashboard builds | High |
| `ensureRecommendationsSynced()` on every dashboard load (analyzers + DB writes) | High — executive/marketing |
| Live page `router.refresh()` every 30s re-ran full server render | High — live view |
| No request-scoped caching (`React.cache`) for snapshot/costs | High — all pages |
| Heavy client bundles (Marketing, Executive) loaded eagerly | Medium — JS parse time |
| No route-level loading skeleton | Medium — perceived latency |

---

## Optimizations Applied

### 1. Request-scoped data layer (`store-bundle.ts`)

- `React.cache` wrappers: `getCachedActiveStoreId`, `getCachedSnapshot`, `getCachedProductCosts`, `getCachedProfitDashboard`, `getCachedStoreBundle`
- **One connector aggregation per HTTP request** regardless of how many services read store data

### 2. Light vs full analytics paths (`analytics.ts`)

| Page | Path | Skips |
|------|------|-------|
| Traffic, Sales, Live, Funnel | `buildLightAnalyticsContext()` | Dashboard, recommendation sync, decision engine |
| Executive, Marketing | `buildFullAnalyticsContext()` | Duplicate snapshot fetches (cached) |

### 3. Dashboard caching (`dashboard.ts`)

- `getCachedDashboard()` — one dashboard build per request
- `getCachedRecommendations()` — skips full analyzer sync if recommendations updated within **15 minutes**
- Parallel fetch: verified snapshot + audits + data sources + costs

### 4. Verified snapshot reuse (`verified-snapshot.ts`)

- `getCachedVerifiedStoreData()` reuses cached raw snapshot

### 5. Service deduplication

Updated to use `getCachedStoreBundle()`:
- `profit.ts`, `attribution.ts`, `funnel.ts`, `products.ts`, `customers.ts`, `inventory.ts`, `reports.ts`

### 6. Eliminated duplicate page fetches

- **Profit:** single `buildProfitPageData()` in page, passed to content component
- **Attribution:** single fetch in page, passed as prop

### 7. Live dashboard polling

- `GET /api/live/metrics?scope=kpis` — lightweight KPI slice every **30s** (no monitor/opportunity scans)
- `GET /api/live/metrics?scope=full` — full mission control every **5m**, cached via `getOrCompute()` when store fingerprint unchanged
- Client merges partial updates only when data changes; `AbortController` on unmount
- Do **not** use full `router.refresh()` on a timer

### 10. Performance NFR (ongoing)

Cursor rule: `.cursor/rules/storepilot-performance.mdc` — merge checklist, refresh tiers, and regression policy.

**Treat performance regressions as bugs.** Before merging: verify render counts, reuse caches, lazy-load heavy UI, paginate large lists, no bundle bloat.

### 8. Loading strategy

- `src/app/analytics/loading.tsx` — instant skeleton while RSC streams
- Dynamic import for `MarketingManagerClient` and `ExecutivePageClient`

### 9. Navigation prefetch

- `prefetch={true}` on all sidebar links in `AppNav.tsx`

---

## Expected Improvements (Estimated)

| Page | Before (est.) | After (est.) | Primary win |
|------|---------------|--------------|-------------|
| Traffic | 2–4s server | 0.4–0.8s | Light context, cached snapshot |
| Sales | 2–4s | 0.4–0.8s | Light context |
| Live | 2–4s initial | 0.4–0.8s initial | Light context + API poll |
| Funnel | 1.5–3s | 0.4–0.8s | Cached bundle |
| Profit | 1.5–3s (2× fetch) | 0.5–1s | Deduped fetch |
| Executive | 4–8s | 1.5–3s | Cached snapshot + sync TTL + lazy JS |
| Marketing | 4–8s | 1.5–3s | Same as executive |

---

## Remaining Opportunities

1. Cross-request Redis/edge cache for executive summary (15–60 min TTL)
2. Database index audit on recommendations and outcomes tables
3. Chart lazy loading when scrolled into view
4. Stale-while-revalidate for executive RSC payload
5. Verify connector fetches are fully parallel inside registry
