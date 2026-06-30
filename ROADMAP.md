# StorePilot V2 Roadmap

Inspired by what small merchants use daily — **not** a Triple Whale clone. StorePilot stays **simple and AI-first**.

**Priority order is fixed. Do not reorder phases.**

---

## Phase 1 — Net Profit Dashboard (Highest Priority)

**Goal:** Answer *"How much money did I actually make?"*

**Data sources:** Shopify Orders, Products, Cost per Item, Meta Ad Spend, Shipping, Transaction Fees, Refunds.

**Missing COGS:** Manual product cost editing, CSV import (V2), future supplier sync.

**KPIs:** Revenue, Gross Profit, Net Profit, Profit Margin %, Today / Yesterday / 7d / 30d.

**Breakdowns:** Profit by Product, Collection, Channel.

**AI:** Why did profit decrease? Highest-profit products? Products losing money?

**Status:** ✅ Completed — `/profit` page, profit engine, product costs API, executive dashboard at `/`.

---

## Phase 2 — Blended ROAS ✅ Completed

**Goal:** Answer *"Is my advertising actually making money?"*

`Total Revenue / Total Advertising Spend` — Today, Yesterday, 7d, 30d.

**Channels:** Meta (live), Google Ads / TikTok (architecture ready).

Trend charts, channel breakdown, ROAS confidence, advertising efficiency opportunities.

**AI:** Why did ROAS decrease? Meta vs Blended ROAS? Increase ad spend? Is advertising profitable? Best channel?

**Status:** ✅ Completed — `/roas` page, blended ROAS engine, home dashboard integration.

See [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) for full Triple Whale comparison.

---

## Phase 3 — Product Intelligence ✅

**Goal:** AI-powered product-level decision making.

Per product: Revenue, Net Profit, Margin, ROAS, Units Sold, Refund Rate, Inventory, Trends, Health Score.

Views: `/products` dashboard, Hero Products, Hidden Winners, Product Growth opportunities, home widgets.

**AI:** Most profitable? More ads? Losing money? Restock? Bundle? Promote? Hidden winners?

**Status:** Completed.

---

## Phase 4 — Attribution Intelligence ✅

**Goal:** Explain which marketing activities drive profitable revenue.

Multi-touch attribution models, journey timelines, campaign/creative profit, CAC metrics, assisted conversions, confidence scoring.

Dashboard: `/attribution` · AI: budget, creatives, acquisition, assisted touchpoints.

**Status:** Completed.

---

## Phase 5 — AI Autopilot ✅

**Goal:** Answer "What should I do next?" — not just "What happened?"

Daily executive brief, action center, forecasts, alerts, budget/pricing optimizers, decision timeline, executive health score.

Dashboard: `/autopilot` · Ask AI executive chat.

**Status:** Completed.

---

## Phase 6 — Connect Everything ✅

**Goal:** Replace demo data and estimated models with live business integrations.

Every recommendation becomes more accurate as more data sources connect.

**Routes:** `/integrations`, `/api/integrations`

**Integrations (priority order):**

1. Google Ads — campaigns, ad groups, keywords, search terms, PMax, Shopping
2. TikTok Ads — campaigns, ad groups, creatives, daily spend, conversions → Blended ROAS
3. Klaviyo — campaign/flow revenue, email & SMS attribution
4. GA4 — sessions, landing pages, UTMs, source/medium, device, geo → attribution confidence
5. Meta Conversion API — purchase, add to cart, initiate checkout, view content
6. Inventory — Cin7, Stocky, Katana, Inventory Planner
7. Accounting — QuickBooks, Xero actual COGS
8. Shipping — ShipStation, EasyPost, ShipBob per-order costs
9. Support — Gorgias, Zendesk support cost in profitability
10. Warehouse — fulfillment time, packing cost, processing delays

**Engine changes:** Integration snapshot merged in connector registry; operational costs subtracted from net profit; attribution uses GA4 touchpoints when available; data confidence banner on home dashboard.

**Live sync:** Configure via environment variables; demo stores use sample integration data when `INTEGRATIONS_DEMO` is enabled (default).

**Status:** Completed — integration hub, confidence scoring, profit/ROAS/attribution wiring. OAuth/API clients for each provider are env-gated stubs ready for production credentials.

---

## Phase 6A — Validation & Real Store Testing ✅

**Goal:** Prove accuracy and merchant value before public launch — no new features until validated.

**Routes:** `/validation`, `/api/validation`, `/api/recommendations/feedback`

**Deliverables:**

- Automated validation suite (profit 0% tolerance, ROAS, attribution confidence, AI evidence, performance at 100–50K orders)
- Internal validation dashboard with go/no-go checklist
- Recommendation feedback (👍/👎 + reason) → `recommendation_feedback`
- Pilot program playbook (`PILOT_PROGRAM.md`, `VALIDATION.md`)
- `npm run validate` Vitest suite

**Status:** Completed — shift focus to real merchant pilots.

---

## AI Commerce Advisor — Insight Engine (Phases 1–7)

StorePilot evolves from reporting into an **AI Commerce Advisor** that tells merchants what to do next.

### Phase 1 — Complete the AI Insight Engine ✅

**Google Ads** (`src/lib/insights/google-ads.ts`): zero-conversion spend, CPA above average, ROAS below target, budget-limited campaigns, CPC growth, conversion decline, scale-ready campaigns, Search vs Shopping, branded vs non-branded, weekend vs weekday.

**Meta Ads** (`src/lib/insights/meta-ads.ts`): high frequency, creative fatigue, CTR decline, CPM increase, high spend/low purchases, winning creatives, best audiences, prospecting vs retargeting, learning limited, budget saturation.

**Shopify** (`src/lib/insights/shopify.ts`): low-inventory bestsellers, dead inventory, high-margin/low-traffic, cart abandonment, declining sales, fast-growing products, bundle opportunities, low-conversion collections, returning customer opportunities.

### Phase 2 — Unified Opportunity Engine ✅

All sources return `CommerceOpportunity` schema. Merged in `buildCommerceOpportunities()` from Shopify, Google Ads, Meta, GA4, Klaviyo, Merchant Center.

### Phase 3 — AI Prioritization ✅

`computePriorityScore()` ranks by severity, revenue/profit impact, confidence, recency. Critical opportunities always surface first.

### Phase 4 — Explainability ✅

Every opportunity includes `why` + `supportingMetrics` + confidence. Evidence filter rejects insights without data (`src/lib/insights/registry.ts`).

### Phase 5 — Executive Dashboard ✅

`ExecutiveSummaryStrip` — Store Health, Revenue, Profit, ROAS, Critical Issues, Opportunities, AI Recommendation of the Day, Last Sync Status.

### Phase 6 — Daily AI Brief ✅

`buildCommerceDailyBrief()` — yesterday revenue, Google ROAS, Meta CTR, prioritized opportunity impact.

### Phase 7 — Action-Ready Architecture ✅

`src/lib/insights/actions.ts` — Pause Campaign, Increase/Decrease Budget, Create Discount, Restock Product, Create Email Campaign (execution wired when OAuth scopes allow).

---

## Phase 8 — Store Health Score ✅

**Goal:** Single transparent Store Health Score (0–100) with explainable point changes.

**Factors:** Revenue trend, profit trend, blended ROAS, conversion rate, inventory health, marketing efficiency, customer retention, active critical issues.

**UI:** `StoreHealthScoreCard` on home dashboard — score, factor breakdown, delta explanations vs prior day.

**Engine:** `src/lib/store-health/score.ts` · persisted factor scores in `daily_snapshots.factor_scores`.

---

## Phase 9 — Estimated Revenue Impact ✅

**Goal:** Every recommendation shows structured business impact.

**Fields:** Monthly revenue impact, estimated profit, confidence %.

**UI:** `RevenueImpactPanel` on `OpportunityCard` and `RecommendationCard`.

**Engine:** `src/lib/impact/estimate.ts`.

---

## Phase 10 — AI Timeline ✅

**Goal:** Chronological activity feed — merchant's daily activity log.

**Events:** ROAS changes, inventory risks, campaign issues, new opportunities, store sync.

**UI:** `AiActivityTimeline` on home dashboard.

**Engine:** `src/lib/timeline/activity-feed.ts`.

---

## Phase 11 — Opportunity History ✅

**Goal:** Track every recommendation over time (Detected → Viewed → Ignored → Resolved → Expired).

**DB:** `opportunity_history` table · API `/api/opportunity-history`.

**UI:** `OpportunityHistoryCard` with action-rate summary.

---

## Phase 12 — AI Learning ✅

**Goal:** Reduce priority / suppress duplicates on repeated ignores; boost confidence on positive outcomes.

**Engine:** `src/lib/learning/fatigue.ts` wired into `applyLearningToOutputs`.

**DB:** `ignore_count`, `suppressed_until`, `positive_outcome_count` on recommendations.

---

## Phase 13 — Weekly AI Report ✅

**Goal:** Executive weekly summary suitable for founders / marketing teams.

**Includes:** Revenue, profit, ROAS, best products, worst campaigns, biggest opportunities, resolved issues, top recommendation.

**Persistence:** `weekly_ai_reports` table via `src/lib/db/weekly-reports.ts`.

---

## Phase 14 — Natural Language Assistant ✅ (superseded by AI Copilot)

**Goal:** Ask AI using StorePilot's internal analytics with supporting data.

**Examples:** "Why did my ROAS decrease?", "Which campaigns should I pause?", "What products deserve more ad budget?"

**Engine:** `src/lib/ai/advisor.ts` (legacy rule-based router). Primary interface is now **AI Commerce Copilot** below.

---

## AI Commerce Copilot ✅

**Goal:** Transform StorePilot into a conversational AI Commerce Copilot — the primary merchant interface.

Merchants ask questions; the copilot answers using real store data, not generic AI knowledge.

**Architecture** (`src/lib/copilot/`):

```
User Question → Intent Detection → Relevant Data Sources → Insight Engine → AI Reasoning → Evidence → Response
```

| Module | File |
|--------|------|
| Intent detection + follow-ups | `intents.ts` |
| Session memory | `session.ts` |
| Data bundle | `data.ts` |
| Reuse existing insights | `insights.ts` |
| Structured response | `response.ts` |
| Per-intent handlers | `handlers.ts` |
| Orchestrator | `orchestrator.ts` |

**Response format:** Summary · Supporting Evidence · Confidence % · Recommended Actions · Estimated Business Impact.

**Session memory:** Follow-ups like "What about last week?" and "Compare with Meta" resolve from prior turns.

**Suggested prompts:** `COPILOT_SUGGESTED_PROMPTS` in chat UI.

**Insight reuse:** Matches existing `CommerceOpportunity` records before generating new analysis — keeps answers consistent with the dashboard.

**Action-ready:** Recommendations expose `futureAction` + `available: false` until execution is enabled.

**API:** `POST /api/ask-ai/chat` → `runCopilotQuery()`

**UI:** `/ask-ai` — AI Copilot chat with structured evidence panels.

**Example questions:** Why did sales decrease? Which campaigns to pause? What should I do today? Which products deserve more budget? Why is ROAS decreasing? Biggest opportunities / risks? Best marketing channel?

---

## Proactive AI Store Manager (Phases 10–16)

StorePilot evolves from a reactive copilot into a **proactive AI Store Manager** that monitors, predicts, recommends, and (eventually) executes.

### Phase 10 — Proactive AI ✅

**Goal:** Merchants should not need to ask — StorePilot surfaces important changes automatically.

**Monitors** (`src/lib/monitoring/`): Revenue, ROAS, Inventory, Campaign, Customer, Marketing Efficiency, Predictive, Opportunity.

**AIEvent schema:** type, severity, title, description, evidence, recommendation, confidence, estimatedImpact, futureAction.

**UI:** `AiEventFeed` on home dashboard · merged into `activityFeed` timeline.

### Phase 11 — Predictive Intelligence ✅

**Goal:** Predict what is likely to happen — not only explain the past.

**Engine:** `src/lib/predictions/engine.ts` — revenue, profit, stockout, campaign profitability, ROAS forecast, cash flow.

**Each prediction exposes:** prediction, confidence, primary factors, possible actions.

**UI:** Enhanced `PredictiveIntelligencePanel`.

### Phase 12 — Revenue & Profit Simulator ✅

**Goal:** Model decisions before making them.

**Scenarios:** Increase Google budget, Increase Meta budget, Apply 20% discount (+ existing what-if types).

**Engine:** `src/lib/ai/what-if-engine.ts` · `POST /api/simulations/quick`.

**UI:** `SimulatorQuickPanel` on dashboard and `/decisions`.

### Phase 13 — AI Memory ✅

**Goal:** Remember ignored/accepted/resolved recommendations; reduce repeated suggestions.

**Engine:** `src/lib/memory/recommendation-memory.ts` — fatigue applied to commerce opportunity priority via `applyMemoryToOpportunity()`.

**Data:** `opportunity_history` ignore counts + recommendation statuses.

### Phase 14 — Automated Daily Brief ✅

**Goal:** Under-one-minute executive summary every morning.

**Sections:** Store Health, Yesterday's Performance, Critical Issues, New Opportunities, Revenue/Profit Trends, Recommendation of the Day.

**Engine:** `src/lib/brief/morning-brief.ts` · **UI:** `MorningExecutiveBriefCard`.

### Phase 15 — AI Decision Center ✅

**Goal:** Single place for all recommendations with why, evidence, confidence, impact, status, and future actions.

**Engine:** `src/lib/decisions/center.ts` · **UI:** `/decisions` + home dashboard preview.

Critical recommendations always surface first.

### Phase 16 — Autonomous Execution (architecture) ✅

**Goal:** Approval-gated execution architecture ready for future OAuth scopes.

**Engine:** `src/lib/actions/executor.ts` — `ApprovalGatedExecutor`, `requestActionExecution()`.

**Actions registry:** `src/lib/insights/actions.ts` — all `available: false` until platform APIs are wired.

---

## Phase 15 — Predictive Intelligence ✅

**Goal:** Warn merchants before problems occur.

**Predictions:** 7-day revenue, stockout risk, campaign profitability, ROAS forecast, inventory depletion, cash flow.

**UI:** `PredictiveIntelligencePanel` on home dashboard.

**Engine:** `src/lib/predictions/engine.ts`.

---

## Long-Term Vision — Autonomous AI Commerce Manager

| Level | Capability | Status |
|-------|------------|--------|
| 1 | Collect data | ✅ |
| 2 | Analyze data | ✅ |
| 3 | Answer questions (AI Copilot) | ✅ |
| 4 | Detect problems automatically | ✅ Phase 10 |
| 5 | Predict future outcomes | ✅ Phase 11 |
| 6 | Recommend decisions | ✅ Phase 15 Decision Center |
| 7 | Execute approved actions | 🔜 Phase 16 (architecture ready) |

---

## Multi-Platform Commerce Architecture ✅

**Goal:** StorePilot is an AI operating system for ecommerce — not a Shopify-only product.

**Commerce provider layer** (`src/lib/commerce/`):

| Module | Role |
|--------|------|
| `types.ts` | Provider-neutral `CommerceProduct`, `CommerceOrder`, `NormalizedCommerceSnapshot` |
| `provider.ts` | `CommerceProviderAdapter` interface |
| `providers/shopify.ts` | First live adapter (maps Shopify API → common model) |
| `normalize.ts` | `normalizeCommerceSnapshot()` — AI layer entry point |
| `registry.ts` | Platform catalog (Shopify available, others planned) |

**Connections catalog** (`src/lib/connections/catalog.ts`):

- Commerce Platforms (Shopify + 8 planned)
- Marketplaces (Amazon, eBay, Etsy)
- Advertising, Analytics, Marketing, Finance, Business Systems

**UI:** `/connections` — categorized `ConnectionCategoryGrid`

**Rule:** AI, copilot, and insights consume `NormalizedCommerceSnapshot` — never platform-specific APIs.

**Next providers:** Amazon Seller Central, WooCommerce, BigCommerce (add adapter in `providers/` + register in `COMMERCE_PROVIDER_ADAPTERS`).

---

## Product Principles

StorePilot is **not** another analytics dashboard.

Every metric must help merchants decide:

1. Where did I make money?
2. Where did I lose money?
3. What should I do next?

If a feature does not improve decision-making, do not build it.
