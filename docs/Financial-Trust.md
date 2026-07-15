# Financial Trust — Validation & Integrity

StorePilot is an **AI decision platform**. Recommendations are only as trustworthy as the numbers behind them.

A financial metric is **trusted** only if it is:

1. Derived from canonical formulas (`src/lib/calculations/formulas`)
2. Traceable to raw source data (Shopify / Meta / Google exports)
3. Reproducible from the same inputs
4. Verified against an **independent** recalculation
5. Consistent across every screen (Executive / Approval / History)
6. Covered by automated CI tests
7. Explainable to the merchant (source, formula, assumptions, sync time, confidence)
8. **Reconciled with the source platform** (or within accepted tolerance) and **fresh enough to act**

If any condition fails → treat the metric as **provisional**. Do not present it as authoritative.

**Only trusted metrics should drive Executive recommendations.**

**Decision correctness** is a separate layer — see `docs/Decision-Trust.md`.

---

## How to run

```bash
# Full financial gate (golden + integrity + reality)
npm run test:financial

# Reality Validation only
npm run test:reality
```

---

## Two suites (both required)

| Suite | Proves | Code |
|-------|--------|------|
| **Golden / Integrity** | Code stability — formulas don't drift | `integrity/`, `golden/` |
| **Reality Validation** | Business accuracy — numbers match the merchant's platforms | `reality/` |

Internal correctness is necessary but not sufficient.

---

## Phase map

| Phase | What | Code |
|-------|------|------|
| 1 KPI validation | Formula + source + expected + test | `integrity/registry.ts` |
| 2 E2E reconcile (engine) | Raw → KPIs → Decision → Impact → screens | `integrity/__tests__/e2e-reconciliation.test.ts` |
| 3 Independent verify | Separate arithmetic (no formula imports) | `integrity/independent.ts` |
| 4 Integrity suite | Structural identities | `integrity/checks.ts` |
| **Reality Phase 2** | Shopify / Meta / Google / GA4 reconciliation | `reality/` |
| Explainability | `CalculationAudit` | `calculations/audit/` |

---

## Reality Validation Report

`buildRealityValidationReport(storePilotKpis, platformObservations)` → `RealityValidationReport`

Example:

| KPI | StorePilot | Source | Diff | Status |
|-----|------------|--------|------|--------|
| Revenue | $52,340 | Shopify $52,340 | 0.00% | **Verified** |
| Ad Spend | $12,100 | Meta $12,087 | 0.11% | **Within Tolerance** (timezone) |

### Statuses

| Status | Meaning |
|--------|---------|
| Verified | Exact match (within abs epsilon) |
| Within Tolerance | ≤1% (or explained gap ≤5%) |
| Needs Investigation | Unexplained material gap |
| Missing Source | No platform value / merchant didn't provide (e.g. COGS) |
| Cannot Validate | Not applicable for direct platform compare |

### Financial Trust Score

```
Financial Trust  98.7%
Verified KPIs    21 / 22
Unverified       Inventory Cost — merchant does not provide COGS
```

### AI Recommendation Gate

- Unverified **Revenue** or **Ad Spend** → lower confidence / block high-confidence Executive actions
- Missing **COGS** → profit estimates **provisional**
- Stale sync (>36h) → KPI not `trusted` even if values match
- Trust Score &lt; 70% → block high-confidence recommendations

Wired into: `isEligibleExecutiveDecision(..., { realityGate })`

---

## Locked integrity fixture (regression)

**Window:** last 30 days · **USD** · CSVs under `integrity/exports/`

| Metric | Locked |
|--------|--------|
| Revenue | $52,340 |
| Net Profit | $13,320 |
| Ad Spend | $12,100 |
| Business Recovery | $6,168 |
| Net Profit Impact | $636 |

---

## Product principle

> Our competitive advantage is not that we have AI.  
> It is that merchants can verify every recommendation back to the original business data.

Related: `docs/Calculation-Bible.md`
