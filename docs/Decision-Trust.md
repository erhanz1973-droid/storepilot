# Decision Trust — Validation of Recommendations

Financial Trust answers: **Are the numbers correct?**  
Decision Validation answers: **Was this the right business action?**

StorePilot measures both.

---

## Principle

> Every recommendation is based on verified financial data **and** continuously evaluated against real business outcomes.

That is stronger than “our calculations are correct.”

---

## DecisionValidationReport

```ts
DecisionValidationReport {
  decisionId,
  predictedOutcome,
  actualOutcome,
  recommendationAccepted,
  businessImproved,
  predictionAccuracy,      // 0–100
  decisionQuality,         // excellent | good | fair | poor | inconclusive
  recommendationCorrect,   // correct | neutral | wrong
  predictionAccurateDecisionWrong,
  explanation
}
```

**Code:** `src/lib/decision-validation/`

### Critical distinction

| Case | Meaning |
|------|---------|
| Prediction accurate + business improved | Excellent decision |
| Prediction accurate + decision wrong | Strategy/context failed (e.g. Meta learning phase) — refine model, not only formulas |
| Prediction inaccurate | Improve Impact Engine / assumptions |

---

## Recommendation Accuracy KPI

```
Last 500 Executive Decisions
Correct 91% · Neutral 6% · Negative 3%
Decision Model Accuracy 91%
```

Built by `buildDecisionAccuracyRollup(reports)`.

---

## Today's Executive Decision Gate

A recommendation becomes Today's #1 only if:

1. **Financial Trust** passes (`realityGate`)
2. **Freshness** implied by trusted critical KPIs
3. **Confidence** ≥ threshold after trust multipliers
4. **Decision Quality model** passes (`evaluateDecisionQualityGate`)

```ts
buildExecutiveTrustGate({ realityGate, decisionQualityGate, modelConfidencePct })
```

Wired into: `isEligibleExecutiveDecision(..., { realityGate, decisionQualityGate })`

---

## Continuous Learning

Every measured recommendation → `ContinuousLearningSignal`:

- Did profit / ROAS / CPA improve?
- Merchant override?
- External factors (learning phase, seasonality, stockout, …)?
- Should this feed the model?

---

## Executive Dashboard (internal)

`ceoOs.decisionModelAccuracy` → **Decision Model Accuracy** card (labeled Internal).

---

## Run tests

```bash
npm run test:decision
npm run test:financial   # includes decision-validation
```

Related: `docs/Financial-Trust.md`
