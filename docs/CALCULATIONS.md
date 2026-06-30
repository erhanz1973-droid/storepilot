# StorePilot AI — Calculation Reference

Every displayed metric should trace to a source field or documented formula below.

## Shopify (source: Admin GraphQL sync)

| Metric | Source | Formula / field |
|--------|--------|-----------------|
| Revenue (30d) | `shopify/sync.ts` → `computeStoreMetrics` | Sum of `order.totalPriceSet.shopMoney.amount` for orders in window |
| Orders (30d) | Same | Count of orders in window |
| Refunds | `computeProfitRollups` | Sum of `totalRefundedSet` per period bucket |
| Discounts | Order line items | Parsed from order discount applications |
| Taxes | Order totals | Included in `totalPriceSet` (gross revenue) |
| Shipping (revenue) | Order shipping lines | Customer-paid shipping in order total |
| Shipping (cost) | `profitRollups.*.shipping` | Merchant shipping cost from order data |
| AOV | `computeStoreMetrics` | `revenue30d ÷ orders30d` |
| Products / inventory | Product sync | Shopify product + inventory levels |
| Customers | Customer sync | Shopify customer records (commerce module) |

**COGS:** Unit cost from Shopify `inventoryItem.unitCost` when present; else `ESTIMATED_COGS_RATE` (45% of price) — flagged in profit confidence.

**Transaction fees (estimated):** `2.9% × revenue + $0.30 × orders` (`profit/constants.ts`).

---

## Meta Ads (source: Graph API Insights)

| Metric | API field | Notes |
|--------|-----------|-------|
| Spend | `insights.spend` | Account + campaign level |
| Impressions | `insights.impressions` | |
| Clicks | `insights.clicks` | |
| CTR | `insights.ctr` or `clicks ÷ impressions` | |
| CPC | `spend ÷ clicks` | |
| CPM | `spend ÷ impressions × 1000` | |
| Purchases | `actions` type `purchase` | |
| Purchase value | `action_values` purchase | |
| ROAS (7d) | Computed | `attributedRevenue ÷ spend` (`meta/sync.ts`) |

---

## Google Ads (source: GAQL search)

| Metric | API field | Notes |
|--------|-----------|-------|
| Spend | `metrics.cost_micros ÷ 1e6` | |
| Impressions | `metrics.impressions` | |
| Clicks | `metrics.clicks` | |
| CTR | `metrics.ctr` | |
| CPC | `metrics.average_cpc` | |
| Conversions | `metrics.conversions` | |
| Conversion value | `metrics.conversions_value` | |
| ROAS | Computed | `conversion_value ÷ spend` |

---

## GA4 (when connected)

| Metric | Status |
|--------|--------|
| Sessions, source/medium, devices, landing pages | **Demo fixture only** — live GA4 Data API not yet implemented |
| Conversion rate (executive) | `Shopify orders30d ÷ GA4 sessions30d × 100` when GA4 present |

---

## Derived business metrics

### Net profit (`profit/engine.ts` → `buildPeriodMetrics`)

```
Net Profit = Revenue − COGS − Shipping cost − Refunds − Transaction fees − Ad spend − Operational cost
```

### Gross profit

```
Gross Profit = Revenue − COGS
```

### Profit margin %

```
Margin % = (Net Profit ÷ Revenue) × 100
```

### Blended ROAS (`profit/roas.ts`)

```
Blended ROAS = Total Shopify revenue (window) ÷ Total ad spend (window)
```

### MER

```
MER = Revenue ÷ Total ad spend
```

### Conversion rate (display)

```
CVR = Orders ÷ Sessions × 100   (requires GA4 sessions)
```

### Average order value

```
AOV = Revenue ÷ Orders
```

---

## Validation

- Profit: `src/lib/validation/profit.ts` (0% tolerance)
- ROAS: `src/lib/validation/roas.ts`
- Cross-platform: `/validation` Meta provider adapter
