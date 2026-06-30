# Metric Validation Table (Phase 1)

> Auto-synced with `src/lib/validation/metric-registry.ts`. Run `npm run validate` for automated status.

| Metric | Source API | API Field / Calculation | Display surfaces | Validation |
|--------|------------|-------------------------|------------------|------------|
| **Revenue (30d)** | Shopify Admin GraphQL | `SUM(orders[].totalPriceSet.shopMoney.amount)` | Executive, Profit, Reports | **PASS** — cross-check Shopify Analytics |
| **Orders (30d)** | Shopify Admin GraphQL | `COUNT(orders)` | Executive, Profit, Live, Reports | **PASS** |
| **AOV** | Shopify (derived) | `revenue30d ÷ orders30d` | Executive, Customers, Reports | **PASS** |
| **Refunds** | Shopify Admin GraphQL | `SUM(totalRefundedSet)` per window | Profit | **PASS** |
| **COGS** | Shopify unit cost or estimate | `unitCost × qty`; fallback 45% | Profit, Products | **ESTIMATED** — flagged when no unit cost |
| **Transaction fees** | Estimate | `2.9% × revenue + $0.30 × orders` | Profit | **ESTIMATED** |
| **Net profit** | Derived | `Revenue − COGS − Shipping − Refunds − Fees − Ad spend − Ops` | Executive, Profit, Reports, Live | **PASS** — 0% tolerance automated |
| **Gross profit** | Derived | `Revenue − COGS` | Profit | **PASS** |
| **Profit margin %** | Derived | `netProfit ÷ revenue × 100` | Profit, Executive | **PASS** |
| **Blended ROAS** | Derived | `Shopify revenue ÷ total ad spend` | Executive, Marketing, Reports | **PASS** — not platform ROAS |
| **Meta spend (7d)** | Meta Graph Insights | `insights.spend` | Marketing, Executive | **PASS** — cross-check Ads Manager |
| **Meta ROAS** | Meta + derived | `purchase_value ÷ spend` | Marketing | **PASS** |
| **Meta impressions/clicks/CTR** | Meta Graph Insights | Passthrough | Marketing | **PASS** |
| **Meta purchases** | Meta Graph Insights | `actions[purchase]` | Marketing | **PASS** |
| **Google spend** | Google Ads GAQL | `cost_micros ÷ 1e6` | Marketing, Executive | **PASS** |
| **Google conversions/value** | Google Ads GAQL | Passthrough | Marketing | **PASS** |
| **Google ROAS** | Derived | `conversions_value ÷ spend` | Marketing | **PASS** |
| **Campaign profit (table)** | Meta `profit7d` when synced | Passthrough or **—** | Marketing | **ESTIMATED** — no fabricated margin |
| **Sessions** | GA4 Data API | `sessions` | Traffic, Executive | **BLOCKED** — connector not live |
| **Conversion rate** | Derived | `orders ÷ GA4 sessions × 100` | Executive | **BLOCKED** without GA4 |
| **Reports revenue/profit** | Same as profit dashboard | Passthrough | Reports | **PASS** — must match Executive |
| **AI estimated impact** | Opportunity engine | Heuristic projection | Decisions, Reports | **ESTIMATED** — forward-looking only |

### Example row (filled during pilot)

| Metric | StorePilot | Shopify Admin | Variance | Status |
|--------|-------------|---------------|----------|--------|
| Revenue 30d | $15,000 | $15,012 | 0.08% | PASS |
| Orders 30d | 142 | 142 | 0% | PASS |
| Net profit 30d | -$18,161 | N/A (manual) | — | PENDING manual sheet |

Record pilot results in [CROSS_VALIDATION.md](./CROSS_VALIDATION.md).
