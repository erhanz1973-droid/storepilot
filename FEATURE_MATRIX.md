# StorePilot vs Triple Whale — Feature Matrix

## Goal

StorePilot is **not** trying to become another enterprise analytics platform.

StorePilot implements the **20% of Triple Whale features that deliver 80% of the value** for Shopify merchants.

Every feature must answer one of these questions:

- How much profit did I make?
- Which products make me money?
- Which ads make me money?
- What should I do next?

See also: [ROADMAP.md](./ROADMAP.md) for implementation phases.

---

# Phase 1 — Completed ✅

## Shopify Integration

**Status:** ✅ Completed

Orders, products, collections, profit rollups, daily revenue series.

## Meta Ads Integration

**Status:** ✅ Completed

Campaign sync, account-level spend rollups, daily ad spend (90d).

## AI Assistant

**Status:** ✅ Completed

Ask AI grounded in store data — profit, ROAS, opportunities, recommendations.

## Profit Dashboard

**Status:** ✅ Completed

**Routes:** `/` (executive dashboard), `/profit` (full breakdown)

**Features:**

- Revenue
- Net Profit
- Profit Margin
- Profit Confidence (estimated COGS warning)
- Today's / 7-Day / 30-Day Profit
- Product Profit Table (sortable, status badges)
- Profit Opportunities (ranked by expected net profit)

**AI questions:**

- Why did profit decrease?
- Which products generate the most profit?
- Which products lose money?
- Which collection is most profitable?
- Why is margin lower this week?

---

# Phase 2 — Completed ✅

## Blended ROAS

**Priority:** ⭐⭐⭐⭐⭐

**Status:** ✅ Completed

**Routes:** `/roas`, `/api/roas`

**Formula:** `Total Shopify Revenue ÷ Total Advertising Spend`

**Features:**

- Blended ROAS (30d primary KPI on home dashboard)
- Today's ROAS
- Yesterday's ROAS
- 7-Day ROAS
- 30-Day ROAS
- Trend vs previous period (green ↑ / red ↓ / gray insufficient data)
- Interactive trend chart (Today / 7 / 30 / 90 days — Revenue, Ad Spend, Blended ROAS)
- Channel breakdown (Meta live; Google, TikTok, Organic, Email, Direct, Referral — architecture ready)
- ROAS Confidence (reduced when ad history is insufficient)
- Advertising Efficiency opportunities (scale, increase/reduce budget, pause — with expected ROAS + net profit gain)

**AI questions:**

- Why did ROAS decrease?
- Why is Meta ROAS higher than Blended ROAS?
- Which channel performs best?
- Should I increase ad spend?
- Is advertising profitable?

**Architecture:** Multi-platform ad spend (`meta_ads`, `google_ads`, `tiktok` placeholders). Meta only today.

---

# Phase 3 — Completed ✅

## Product Intelligence

**Priority:** ⭐⭐⭐⭐⭐

**Status:** Completed

Dedicated Product Intelligence page at `/products` with per-SKU profitability engine.

**Features:**

- Product Profitability Engine (revenue, COGS, shipping, fees, discounts, refunds, ad cost → net profit, margin, ROAS)
- Product Intelligence Dashboard with sortable product cards
- Hero Products & Hidden Winners detection
- Product growth opportunities (`product_growth` category)
- Inventory intelligence (stockout forecast, low stock, overstock, dead inventory)
- Refund intelligence by product
- Product trend analysis (7d / 30d vs prior 30d)
- Product Health Score (0–100)
- Dashboard widgets on home (Top Profitable, Hidden Winners, Losing Money, Inventory Risk, etc.)
- Ask AI product reasoning with evidence and confidence scores

**AI questions:**

- Which products are most profitable?
- Which products should receive more advertising?
- Which products are losing money?
- Why did product profit decrease?
- Which products should I restock?
- Which products should I bundle?
- Which products should I promote this week?
- Which products are hidden winners?

---

# Phase 4 — Completed ✅

## Attribution Intelligence

**Priority:** ⭐⭐⭐⭐☆

**Status:** Completed

Evidence-based multi-touch attribution at `/attribution`.

**Features:**

- Attribution engine with configurable models (Last Click, First Click, Linear, Position Based, Time Decay)
- Customer journey timeline reconstruction
- Campaign profitability ranked by net profit (not vanity revenue)
- Creative intelligence (winning, fatigued, underperforming + recommendations)
- CAC, New/Returning ROAS, Payback Period, LTV:CAC
- Cross-channel attribution (Meta, Google, TikTok, Pinterest, Email, Organic, Direct, Referral, Influencer)
- Assisted conversions and multi-touch contribution
- Attribution confidence scoring
- `marketing_attribution` opportunity category
- Ask AI attribution reasoning with evidence

**AI questions:**

- Which campaigns deserve more budget?
- Which creatives should be paused?
- Which channel acquires the most profitable customers?
- Why did Meta revenue decline?
- Which campaigns generate revenue but not profit?
- Which touchpoints assist conversions the most?

---

# Phase 5 — Completed ✅

## AI Autopilot

**Priority:** ⭐⭐⭐⭐⭐

**Status:** Completed

AI Store Manager at `/autopilot` — proactive actions, not just reporting.

**Features:**

- Today's Store Brief (revenue, profit, ROAS, CAC, products, inventory, ads, opportunities)
- AI Action Center (prioritized queue with net profit gain, confidence, time estimate)
- Profit forecast (7/30/90d optimistic · expected · conservative)
- Inventory forecast (stockout, overstock, lost profit risk)
- Marketing budget optimizer (max net profit, not max ROAS)
- Pricing intelligence per SKU
- Alert Center (profit, ROAS, traffic, inventory, refunds, fatigue, margin)
- AI Decision Timeline (accepted/rejected/measured recommendations)
- Executive Health Score (profitability, growth, marketing, inventory, acquisition, retention, operations)
- Executive Ask AI ("focus today", "biggest problem", "wasting money", etc.)

---

| Feature | Status |
|---------|--------|
| Customer Lifetime Value | Future |
| Cohort Analysis | Future |
| Returning Customers | Future |
| Google Ads Integration | ✅ Phase 6 (demo + env credentials) |
| TikTok Ads Integration | ✅ Phase 6 (Blended ROAS merge) |
| Klaviyo Integration | ✅ Phase 6 (email attribution) |
| GA4 Integration | ✅ Phase 6 (attribution confidence) |
| Meta Conversion API | ✅ Phase 6 (server-side events stub) |
| Inventory Platforms | ✅ Phase 6 (Cin7, Stocky, Katana, Inventory Planner) |
| Accounting (QuickBooks/Xero) | ✅ Phase 6 (actual COGS) |
| Shipping Integrations | ✅ Phase 6 (ShipStation, EasyPost, ShipBob) |
| Customer Support | ✅ Phase 6 (Gorgias, Zendesk costs) |
| Warehouse Operations | ✅ Phase 6 (fulfillment & packing costs) |

---

# Phase 6 — Completed ✅

## Integration Hub

**Status:** ✅ Completed

**Routes:** `/integrations`, `/api/integrations`

**Features:**

- 10-priority integration catalog (Google, TikTok, Klaviyo, GA4, Meta CAPI, inventory, accounting, shipping, support, warehouse)
- Data confidence score on home dashboard
- Operational cost rollup in net profit (shipping, support, warehouse, packing)
- Actual COGS override from accounting when connected
- Google + TikTok spend merged into Blended ROAS
- Klaviyo email channel in ROAS breakdown
- GA4 source/medium feeds attribution journeys
- Meta CAPI status and event tracking stub

**Demo mode:** Full integration demo data when `INTEGRATIONS_DEMO !== "false"` on demo stores.

---

# Phase 6A — Validation & Real Store Testing ✅

## Validation Framework

**Status:** ✅ Completed

**Routes:** `/validation`, `/api/validation`, `npm run validate`

**Features:**

- Automated profit validation (0% tolerance vs manual)
- ROAS window validation (today / 7d / 30d)
- Attribution confidence scenario tests
- AI recommendation evidence checks
- Performance benchmarks (100 → 50K orders)
- Go / no-go checklist on validation dashboard
- Recommendation feedback (👍/👎 + reason)

**Docs:** `VALIDATION.md`, `PILOT_PROGRAM.md`

---

# Future / Not in Phase 6

These features are intentionally excluded from V1/V2:

- SQL Editor
- Custom Dashboard Builder
- Triple Pixel
- Post Purchase Surveys
- Slack Integration
- Enterprise Reporting
- Warehouse Analytics
- Custom Metrics Builder

---

# Product Positioning

StorePilot is **not** an enterprise analytics platform.

StorePilot is a **Profit Intelligence platform** for Shopify merchants.

**Core promise:**

1. Connect Shopify.
2. Connect Meta.
3. Know your real profit.
4. Understand which products and ads make money.
5. Use AI to make better decisions.

**Keep the product simple.**

Every feature must directly improve merchant decision making.

If a feature does not help a merchant make a better business decision, it should not be built.
