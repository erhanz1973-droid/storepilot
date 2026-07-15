# StorePilot Calculation Bible

Financial specification for StorePilot. Every dollar shown in the product must trace to this document and `src/lib/calculations/`.

**Architecture**

```
Layer 1    Raw Facts              → imported data only (no math)
Layer 2    KPI Engine             → calculateBusinessKPIs(facts)
Layer 2.5  Business Model Layer   → BusinessModelConfig (weights, recovery strategy, KPI emphasis)
Layer 3    Decision Engine        → reason, priority, confidence, action (no dollars)
Layer 4    Impact Engine          → calculateDecisionImpact(decision, kpis, businessModel)
```

**Rule:** No screen, presenter, component, or AI prompt implements its own financial logic.

**Financial trust gate:** Before shipping Executive / Approval changes that depend on dollars, run `npm run test:financial` (golden + integrity + **reality**). Spec: `docs/Financial-Trust.md`.

**Long-term vision:** The Formula Library stays universal. The Business Model Layer determines which formulas apply, how they are weighted, and which KPIs are emphasized — so StorePilot supports retailers, dropshippers, subscription, digital, B2B, and hybrid merchants without forking the engine.

---

## Layer 2.5 — Business Model Configuration

**Code:** `src/lib/calculations/business-model/config.ts`  
**Types:** Reuses `BusinessModel` from `src/lib/business-model/types.ts`  
**Tests:** `src/lib/calculations/__tests__/business-model.test.ts`

### BusinessModelConfig

```ts
{
  businessModel,
  profitFormula,
  marginFormula,
  recoveryStrategy,
  recoveryComposition,
  defaultNetMarginRate,
  treatAdSavingsAsEfficiencyGain,
  supplierCostRate,
  recurringRevenueMultiplier,
  inventoryRules,
  paybackRules,
  confidenceWeights,
  primaryKpis,
  optimizationPriorities,
  recoveryDefinition,
}
```

### Entry point

```ts
calculateDecisionImpact(decision, kpis, businessModelConfig)
// or
calculateDecisionImpact(decision, kpis, { businessModel: "subscription", trafficQuality: 0.8 })
```

### Business Recovery by model

Same advertising reduction can produce different **Business Recovery** (Executive hero).  
**Net Profit Improvement** may still follow explicit profit or conversion rules.

| Model | Recovery strategy | Hero composition |
|-------|-------------------|------------------|
| Own Inventory | `margin_plus_waste` | Avoided waste / margin + ad savings |
| Dropshipping | `ads_plus_supplier` | Advertising savings + supplier cost reduction |
| Subscription | `recurring_value` | Reduced churn / future MRR (+ ads) |
| Digital | `ads_plus_high_margin_revenue` | Ad savings + high-margin revenue |
| Hybrid | `hybrid_blend` | Weighted blend of all components |

**Formula (universal components):**

```
composeBusinessRecovery(
  { avoidedWaste, advertisingSavings, recoveredRevenue, marginImprovement },
  businessModelConfig
)
```

**Does not change:** Gross Profit, Net Profit formulas themselves stay in the Formula Library.  
**Does change:** How recovery is composed, default margins, efficiency vs margin conversion, confidence weights, primary KPIs.

### Confidence by model

Weights differ (normalized at use):

| Factor | Own Inventory | Dropship | Subscription | Digital |
|--------|---------------|----------|--------------|---------|
| Inventory accuracy | High | — | — | — |
| Traffic quality | Low | High | — | Highest |
| Retention history | — | — | Highest | — |
| Sample / history | Medium | Medium | Medium | Medium |

**Code:** `formulaConfidenceForModel(factors, config)`

### KPI visibility

KPI engine may compute everything; presentation uses `selectPrimaryKpis(config)`:

| Model | Emphasize |
|-------|-----------|
| Subscription | MRR, Churn, LTV, CAC Payback |
| Own Inventory / Retail | Inventory Days, Gross Margin, Sell-through, Net Profit |
| Digital | ROAS, CVR, AOV, Net Margin % |
| Dropshipping | ROAS, MER, CPA, Contribution Margin |

### Per-formula business model notes

#### Net Profit (`formulaNetProfit`)

| | |
|--|--|
| **Models** | All |
| **Changes by model?** | No structure change; default margins / COGS assumptions differ |
| **Missing data** | COGS estimate 45%; fees from constants |
| **Fallback** | `defaultNetMarginRate` on config when converting impacts |

#### Business Recovery (`composeBusinessRecovery`)

| | |
|--|--|
| **Models** | All (strategy differs) |
| **Changes by model?** | **Yes** — strategy table above |
| **Inputs** | avoidedWaste, advertisingSavings, recoveredRevenue, marginImprovement |
| **Assumptions** | Dropship `supplierCostRate` ≈ 0.72; subscription `recurringRevenueMultiplier` ≈ 3 |
| **Fallback** | Floor at largest meaningful component so Executive hero never collapses |

#### Advertising Savings → Net

| | |
|--|--|
| **Own / Dropship** | Often `treatAdSavingsAsEfficiencyGain = true` (×0.55) |
| **Digital / Subscription** | Prefer store/default margin (`treatAdSavingsAsEfficiencyGain = false`) |
| **Missing margin** | `config.defaultNetMarginRate` |

#### Confidence (`formulaConfidenceForModel`)

| | |
|--|--|
| **Models** | All |
| **Changes by model?** | **Yes** — weight vectors |
| **Missing factors** | Skipped (not zeroed) |

---

## Layer 1 — Raw Facts

**Code:** `src/lib/calculations/facts/types.ts`

Immutable inputs from Shopify, Meta, Google Ads, GA4, and internal stores.

| Fact | Source | Units |
|------|--------|-------|
| Orders | Shopify sync | count |
| Revenue | Shopify order totals | currency |
| COGS | Shopify unit cost or estimate | currency |
| Refunds | Shopify refunds | currency |
| Shipping cost | Order shipping lines | currency |
| Platform fees | Estimated transaction fees | currency |
| Ad spend | Meta / Google connectors | currency |
| Impressions / Clicks | Ad platforms | count |
| Sessions | GA4 (when connected) | count |
| Inventory | Shopify inventory levels | units |

**Assumptions**

- COGS fallback: 45% of price when unit cost missing (`profit/constants.ts`)
- Transaction fees: 2.9% × revenue + $0.30 × orders when not itemized
- Currency: USD primary until multi-currency math ships

**Edge cases**

- Missing COGS → estimated, flagged in profit confidence
- Zero orders → AOV/CVR undefined (null)
- GA4 disconnected → sessions null, CVR unavailable

---

## Layer 2 — KPI Engine

**Code:** `src/lib/calculations/kpis/engine.ts`  
**Formulas:** `src/lib/calculations/formulas/index.ts`  
**Tests:** `src/lib/calculations/__tests__/formulas.test.ts`

### Gross Profit

**Definition:** Revenue minus cost of goods sold.  
**Formula:** `Gross Profit = Revenue − COGS`  
**Units:** currency (monthly/windowed)  
**Used by:** Profit page, Executive, Reports  
**Test:** `formulas.test.ts` → "computes gross and net profit"

### Net Profit

**Definition:** Operating profit after variable costs and ad spend.  
**Formula:**

```
Net Profit = Revenue − COGS − Shipping − Refunds − Platform Fees − Ad Spend − Ops
```

**Units:** currency  
**Data source:** `computeProfitDashboard` rollups → `rawFactsFromProfitDashboard`  
**Used by:** Executive, Profit, Analytics, validation  
**Edge cases:** Negative net profit (losing stores) — display as-is  
**Test:** `formulas.test.ts`, `validation/profit.ts`

### Gross / Net Margin %

**Formula:** `(Profit ÷ Revenue) × 100`  
**Edge cases:** Zero revenue → null

### Blended ROAS / MER

**Formula:** `Revenue ÷ Ad Spend`  
**Used by:** Executive KPIs, Marketing modules  
**Edge cases:** Zero spend → null

### CAC / CPA / AOV / CVR

| KPI | Formula |
|-----|---------|
| CAC | Ad Spend ÷ Customers (orders proxy) |
| CPA | Ad Spend ÷ Purchases |
| AOV | Revenue ÷ Orders |
| CVR | Orders ÷ Sessions × 100 |

---

## Layer 3 — Decision Engine

**Code:** `src/lib/calculations/decisions/types.ts`

Decisions contain **no formatted financial strings**. They carry:

- `reason`, `priority`, `confidenceScore`, `risk`, `goal`
- `affectedEntities`, `expectedAction`
- `financialInputs` (structured numbers only)

**Migration note:** Legacy recommendations still pass `expectedImpactLabel` strings. The Impact Engine parses these until all producers emit structured `financialInputs`.

---

## Layer 4 — Impact Engine

**Code:** `src/lib/calculations/impact/engine.ts`  
**Tests:** `src/lib/calculations/__tests__/impact.test.ts`, `src/lib/impact/__tests__/decision-impact.test.ts`

### DecisionImpact (immutable)

```ts
DecisionImpact {
  businessRecovery,      // Executive hero
  recoverableWaste,
  recoverableRevenue,
  advertisingSavings,
  grossProfitImpact,
  netProfitImpact,
  cashFlowImpact,
  expectedROAS,
  paybackDays,
  confidence,
}
```

**Entry point:** `calculateDecisionImpact(decision, kpis)`  
**Legacy adapter:** `calculateDecisionImpactFromInputs({ expectedImpactLabel, ... }, kpis)`

### Business Recovery (Executive KPI)

**Definition:** Total monthly financial opportunity if the merchant acts today. **Not** net profit.

**Formula:**

```
Business Recovery = Avoided Waste + Recovered Revenue + Margin Improvement
```

**Example (campaign pause):**

- Avoided waste (low savings bound): $6,168/mo
- Net profit improvement: $636/mo
- Executive hero: **$6,168** — Approval waterfall explains path to **$636**

**Used by:** Executive Dashboard (hero), Approval Center (step 1), Story, Ask AI  
**Test:** `impact.test.ts` → "produces consistent executive and approval metrics"

### Advertising Savings

**Formula:** `Current Ad Spend − Expected Ad Spend` (clamped ≥ 0)

**Used by:** Approval waterfall ("Advertising Efficiency Gain")

### Net Profit Improvement

**Definition:** Portion expected in operating profit after implementation.

**Formula (marketing efficiency):**

```
Net Profit = Savings or Revenue × Marketing Efficiency Factor (0.55)
```

**Formula (margin-based):**

```
Net Profit = Revenue × Store Net Margin %  (fallback 38%)
```

**Used by:** Approval Center, History (expected), Profit tracking  
**Test:** `formulas.test.ts` → marketing efficiency + margin paths

### Cash Flow Impact

**Definition:** Near-term cash effect (typically ad savings or net profit).  
**Used by:** Cash flow modules (future)

### Payback Period

**Formula:** `Implementation Cost ÷ (Monthly Net Profit Gain ÷ 30)` days  
**Edge cases:** Zero profit gain → null payback

### Confidence

**Definition:** Reliability of the projection (0–100%).

**Formula (geometric mean of available factors):**

```
Confidence = f(Data Quality, Sample Size, Prediction Stability, Historical Accuracy)
```

**Inputs:**

- `confidenceScore` from recommendation model (0–1)
- Order volume via `formulaSampleSizeScore`
- Historical accuracy from measured outcomes (when available)

**Used by:** Executive support metrics, Approval details, Confidence cards  
**Test:** `formulas.test.ts` → "computes confidence from measurable factors"

---

## Screen responsibilities

| Screen | Reads | Never computes |
|--------|-------|----------------|
| Executive Dashboard | `DecisionImpactPresentation.heroAmount`, `netProfitAmount`, `confidencePct` | ✓ |
| Approval Center | `waterfall`, `waterfallNarrative`, `paybackDays` | ✓ |
| Story / Ask AI | `DecisionImpact` | ✓ |
| History | `DecisionImpact` + `ActualOutcome` | ✓ |
| Profit page | `BusinessKPIs` from facts | ✓ |

---

## Regression: $6,168 vs $636

**Root cause (fixed):** Executive parsed first `$` in label; Approval converted savings through margin — different parsers.

**Fix:** Single Impact Engine; Executive shows `businessRecovery`; Approval shows waterfall to `netProfitImpact`.

**Test:** `src/lib/impact/__tests__/decision-impact.test.ts`

---

## Layer 5 — Financial Audit & Explainability

**Goal:** Every number shown in StorePilot is auditable, reproducible, and consistent across screens.

### Pipeline (immutable outputs at each stage)

```
Raw Facts → KPI Engine → Decision Engine → Impact Engine → Presentation
```

**Code:** `src/lib/calculations/audit/`  
**Version:** `FORMULA_ENGINE_VERSION` in `src/lib/calculations/version.ts` (currently `1.3.2`)

### CalculationAudit

`buildCalculationAudit({ decision, rawFacts, … })` returns an immutable record:

- `decisionId`, `formulaVersion`, `timestamp`
- `rawFacts`, `calculatedKPIs`, `decision`, `decisionImpact`, `presentation`
- `explained.*` — each metric as `{ value, inputs, formula, intermediateSteps, … }`
- `pipeline` — stage snapshots
- `warnings`, `verificationMode`, `decisionImpactFingerprint`

Screens should **render from** the audit / `DecisionImpact`, never reinvent math.

### ExplainedValue

Formulas used for merchant transparency return steps (not bare numbers):

```
Revenue → COGS → Gross Profit → Advertising → … → Net Profit
```

UI: `MetricInfo` + `MetricExplainDrawer` (info button opens waterfall + sources + assumptions + confidence).

### Cross-screen validation

`validateCrossScreenImpact` / `assertExecutiveMatchesImpact` / `assertApprovalMatchesImpact`  
Executive hero = `businessRecovery`; Approval net = `netProfitImpact` — same object, different fields. Drift → **FAIL BUILD**.

### Golden dataset + CI

`src/lib/calculations/golden/campaign-recovery-30d.ts`  
17 campaigns · last 30d · locked: Recovery **6168**, Net **636**, ROAS **2.68**  
Test: `src/lib/calculations/__tests__/golden-audit.test.ts`

### Verification Mode

Env: `STOREPILOT_VERIFICATION_MODE=1` (or inspector toggle). Logs inputs/outputs and surfaces warnings/assumptions.

### Decision Inspector

`/dev/decision-inspector` (dev gate) — paste Decision ID (golden: `DEC-GOLDEN-2026-000001`) and inspect full trace.

### Production-ready number checklist

A financial number is valid only if it is:

1. Derived from one canonical formula  
2. Traceable to raw source data  
3. Reproducible with the same inputs  
4. Consistent across screens  
5. Explainable step by step  
6. Covered by automated regression tests  
7. Tagged with `formulaVersion`

---

## File map

| Path | Layer |
|------|-------|
| `src/lib/calculations/facts/` | 1 |
| `src/lib/calculations/formulas/` | 2 formulas |
| `src/lib/calculations/kpis/engine.ts` | 2 engine |
| `src/lib/calculations/business-model/` | 2.5 |
| `src/lib/calculations/decisions/types.ts` | 3 |
| `src/lib/calculations/impact/engine.ts` | 4 |
| `src/lib/calculations/audit/` | 5 audit + explainability |
| `src/lib/calculations/golden/` | Golden regression datasets |
| `src/lib/calculations/version.ts` | Formula engine version |
| `src/lib/calculations/index.ts` | Public API |
| `src/lib/impact/decision-impact.ts` | Legacy facade → calculations |
| `src/lib/opportunities/profit-impact.ts` | Legacy facade → formulas |
| `src/lib/profit/engine.ts` | Historical P&L (feeds Layer 1) |
| `/dev/decision-inspector` | Developer Decision Inspector |

---

## Test matrix

| Scenario | Test file |
|----------|-----------|
| Positive / negative profit | `formulas.test.ts` |
| Zero spend / zero revenue | `formulas.test.ts` |
| Campaign savings range + profit | `impact.test.ts`, `decision-impact.test.ts` |
| Golden recovery / net / ROAS lock | `golden-audit.test.ts` |
| Cross-screen impact equality | `golden-audit.test.ts` |
| High / low ROAS inputs | `validation/roas.ts` |
| Missing data | `formulas.test.ts` (null returns) |
| Approval decision center | `approvals/__tests__/decision-center.test.ts` |
| Executive unified | `analytics/__tests__/executive-unified.test.ts` |

---

## Adding a new metric

1. Add formula to `src/lib/calculations/formulas/index.ts`
2. Add unit test in `src/lib/calculations/__tests__/formulas.test.ts`
3. Wire into `calculateBusinessKPIs` or `calculateDecisionImpact` — **not** UI
4. Document in this file (definition, formula, sources, edge cases, tests)
5. Add row to `docs/CALCULATION_REGISTRY.md` if production-validated

---

## Related docs

- `docs/CALCULATIONS.md` — connector field reference
- `docs/CALCULATION_REGISTRY.md` — metric registry
- `docs/SOURCE_TRACEABILITY.md` — data lineage
