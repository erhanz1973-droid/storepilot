# Real Merchant Pilot Program (Phase 6A)

StorePilot AI is feature-complete through Phase 5 (AI Autopilot) and Phase 6 (Integrations). **Do not build additional features until pilot validation succeeds.**

## Goal

Prove that StorePilot delivers **accurate insights**, **trustworthy recommendations**, and **measurable business value** on real Shopify stores.

---

## Recruitment

Target **5–10 merchants** across industries:

| Industry | Example |
|----------|---------|
| Fashion | Apparel DTC |
| Beauty | Skincare / cosmetics |
| Coffee | Subscription roaster |
| Electronics | Gadgets / accessories |
| Home goods | Furniture / decor |
| Jewelry | Fine / fashion jewelry |

**Offer:** Free or heavily discounted access for 8–12 weeks.

**Requirements:**

- Active Shopify store (500+ orders/month preferred)
- Willing to connect Meta Ads (minimum)
- 15-minute weekly feedback call or async form

---

## Weekly feedback (primary question)

> **"Did StorePilot AI help you make better business decisions this week?"**

### Structured form (store in `pilot_feedback` table)

1. Did StorePilot help you make a decision? (yes / no / unsure)
2. What decision did you make (or consider)?
3. Which feature was most useful? (Profit / ROAS / Products / Attribution / Autopilot / Ask AI)
4. What was confusing or missing?
5. Would you pay for this after the pilot? (yes / maybe / no)
6. Industry category

---

## Onboarding checklist

1. Connect Shopify (`/connected-store`)
2. Connect Meta Ads
3. Add product costs where missing (`/profit`)
4. Review first Autopilot brief (`/autopilot`)
5. Run one Ask AI question (`/ask-ai`)
6. Approve or reject 3 recommendations (`/approvals`)

**Success metric:** Time to first useful insight **< 15 minutes**.

---

## UX observation (no guidance)

For 2–3 pilot merchants, observe first session:

| Metric | Target |
|--------|--------|
| Time to first insight | < 5 min |
| Time to first useful action | < 15 min |
| Navigation confusion | None blocking |
| Ask AI usage | ≥ 1 question in week 1 |

Record friction in weekly notes — **prioritize UX fixes before new features**.

---

## Recommendation tracking

Every recommendation lifecycle is tracked:

| Field | Source |
|-------|--------|
| Recommendation | `recommendations` table |
| Accepted / Rejected | status + approvals |
| Implemented | `implemented_at` |
| Outcome | `recommendation_outcomes` |
| Merchant feedback | `recommendation_feedback` |
| Estimated vs actual profit | measurement engine |

Review metrics at `/validation` weekly.

---

## Launch decision

Proceed to public launch only when:

1. Automated validation suite passes (`/validation?run=1`)
2. ≥ 70% of pilot merchants answer **yes** to the primary question in week 4+
3. Recommendation acceptance rate ≥ 40%
4. No critical profit/ROAS discrepancies reported by pilots

---

## Contact template

```
Subject: StorePilot AI — free pilot for [Store Name]

We're inviting a small group of Shopify merchants to validate StorePilot AI —
profit intelligence + AI recommendations (no automatic store changes).

You'd get free access for 8 weeks in exchange for 15 min/week feedback.

Interested? Reply with your Shopify domain and primary ad channel.
```
