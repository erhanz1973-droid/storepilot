# Calculation Registry (Phase 2)

Machine-readable source: `src/lib/validation/metric-registry.ts`

Nothing should be a magic number without documentation here.

---

## Net Profit

| Property | Value |
|----------|-------|
| **Formula** | `Revenue − COGS − Shipping − Refunds − Payment fees − Ad spend − Operational cost` |
| **Code** | `lib/profit/engine.ts` → `buildPeriodMetrics` |
| **Dependencies** | Shopify orders, product costs, Meta/Google spend sync |
| **Estimated inputs** | COGS (45% fallback), transaction fees (2.9% + $0.30) |
| **Validation** | **PASS** — `lib/validation/profit.ts` automated 0% tolerance |
| **Expected range** | Any real store value; negative when ad spend + costs exceed revenue |

---

## Gross Profit

| Property | Value |
|----------|-------|
| **Formula** | `Revenue − COGS` |
| **Code** | `lib/profit/engine.ts` |
| **Dependencies** | Shopify |
| **Validation** | **PASS** |

---

## Blended ROAS

| Property | Value |
|----------|-------|
| **Formula** | `Total Shopify revenue (window) ÷ Total ad spend (window)` |
| **Code** | `lib/profit/roas.ts` → `computeRoas` |
| **Dependencies** | Shopify, Meta, Google (active connectors) |
| **Validation** | **PASS** — `lib/validation/roas.ts` |
| **Note** | Uses store revenue, not platform-attributed revenue |

---

## MER

| Property | Value |
|----------|-------|
| **Formula** | `Revenue ÷ Total ad spend` (identical inputs to blended ROAS) |
| **Code** | Same as blended ROAS |
| **Validation** | **PASS** |

---

## Average Order Value

| Property | Value |
|----------|-------|
| **Formula** | `Revenue ÷ Orders` |
| **Code** | `lib/shopify/sync.ts` → `computeStoreMetrics` |
| **Dependencies** | Shopify |
| **Validation** | **PASS** |

---

## Conversion Rate

| Property | Value |
|----------|-------|
| **Formula** | `(Orders ÷ GA4 sessions) × 100` |
| **Code** | `lib/analytics/executive.ts` |
| **Dependencies** | Shopify + GA4 |
| **Validation** | **BLOCKED** until GA4 live connector |
| **Without GA4** | Displays **—** |

---

## Meta Campaign ROAS

| Property | Value |
|----------|-------|
| **Formula** | `Meta purchase action value ÷ Meta spend` |
| **Code** | `lib/meta/sync.ts` |
| **Dependencies** | Meta Ads OAuth + sync |
| **Validation** | **PASS** — `/api/validation/meta` cross-check |

---

## Meta CTR / CPC / CPM

| Property | Value |
|----------|-------|
| **CTR** | API `insights.ctr` or `clicks ÷ impressions` |
| **CPC** | `spend ÷ clicks` |
| **CPM** | `spend ÷ impressions × 1000` |
| **Code** | `lib/meta/sync.ts`, `lib/analytics/marketing.ts` |
| **Validation** | **PASS** |

---

## Google ROAS

| Property | Value |
|----------|-------|
| **Formula** | `metrics.conversions_value ÷ spend` |
| **Code** | `lib/google-ads/api.ts` |
| **Validation** | **PASS** — `npm run verify:google` |

---

## Campaign profit (Marketing table)

| Property | Value |
|----------|-------|
| **Formula** | `campaign.profit7d` when synced; otherwise **not displayed** |
| **Code** | `lib/analytics/marketing.ts` |
| **Validation** | **ESTIMATED** — requires per-campaign profit allocation |
| **Removed** | ~~`revenue × 0.28 − spend × 0.1`~~ (was magic number) |

---

## AI recommendation estimated impact

| Property | Value |
|----------|-------|
| **Formula** | Heuristics per opportunity type in `lib/opportunities/engine.ts` |
| **Type** | **Projection** — not a historical KPI |
| **Validation** | **ESTIMATED** — measured after recommendation completion |

---

## Reports financial impact

| Property | Value |
|----------|-------|
| **Formula** | Derived from `topOpportunities`, `aiPerformance.revenueInfluenced`, worst campaign weekly spend |
| **Code** | `lib/reports/build-weekly-briefing.ts` → `buildFinancialImpact` |
| **Validation** | **PENDING** pilot measurement |
| **Removed** | ~~Hardcoded `$2,400` / `$1,200` ad waste~~ |

---

## Constants (documented estimates)

| Constant | Value | Location | When used |
|----------|-------|----------|-----------|
| `DEFAULT_TRANSACTION_FEE_RATE` | 2.9% | `lib/profit/constants.ts` | No per-order fee data |
| `DEFAULT_TRANSACTION_FEE_FIXED` | $0.30 | `lib/profit/constants.ts` | Per order |
| `ESTIMATED_COGS_RATE` | 45% | `lib/profit/constants.ts` | No Shopify unit cost |

All estimates surface in profit **confidence** score and sublabels where applicable.
