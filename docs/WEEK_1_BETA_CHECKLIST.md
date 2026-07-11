# StorePilot Private Beta — Week 1 Release Checklist

**Objective:** Prepare StorePilot for its first real Shopify merchants. Focus on reliability, trust, onboarding, and product readiness — not new features.

**Validation phase:** Complete all scenarios in [`docs/BETA_VALIDATION.md`](BETA_VALIDATION.md) on real Shopify stores before inviting beta merchants.

**Success:** One week without critical failures, trustworthy financials, logically consistent AI, value within 5 minutes for a new merchant, support can diagnose issues quickly.

---

## Priority 1 — Critical Bug Fixes (P0)

| Item | Status | Notes |
|------|--------|-------|
| Runtime errors / unhandled exceptions | 🟡 In progress | Live Mission Control abort handling fixed; DecisionMemoCard + MerchantModeSelector fetch catches added |
| Broken navigation | ✅ Fixed | Live inventory events → `/analytics/inventory` (was `/inventory` 404) |
| Loading states | 🟡 In progress | Added `loading.tsx` for `/live`, `/decisions`, `/health`; advertising/executive use dynamic skeletons |
| Segment error boundaries | ✅ Fixed | Added `error.tsx` for `/advertising`, `/analytics`, `/live`, `/approvals`, `/decisions` |
| Failed API retries / user recovery | 🟡 Partial | Read-only dashboard path on heavy pages; friendly errors still needed on OAuth selectors |
| OAuth edge cases | 🔴 Audit | Account select empty states (Google/GA4) need copy |
| Performance (slow pages) | 🟡 In progress | `buildReadOnlyDashboard`, page caches for advertising/approvals/ask-ai |
| Mobile / tablet UI | 🔴 Audit | Not yet tested systematically |

---

## Priority 2 — Remove Demo Behavior

| Item | Status | Notes |
|------|--------|-------|
| Demo recommendations on live stores | 🟡 In progress | `listRecommendations` uses TTL cache, not full sync every load |
| Fake AI accountability narratives | ✅ Fixed | Demo accountability items gated: `allowDemoData()` + demo snapshot only |
| Executive error → demo fallback | ✅ Fixed | Production rethrows; demo fallback only when `STOREPILOT_ALLOW_DEMO` / dev |
| Demo learning seed on live | ✅ Fixed | `seedDemoLearningIfNeeded` gated behind `allowDemoData()` |
| Hybrid simulation ads on live merchants | ✅ Fixed | `ad-layer.ts` gated with `mayUseSyntheticData()` |
| DemoDataBadge accuracy | ✅ Fixed | Badge keyed to active store ID, not account-wide Shopify link |
| Shopify demo fallback on live stores | ✅ Fixed | Live stores get empty snapshot on missing install / token errors |
| AI synthetic timelines on live | ✅ Fixed | `buildAiManagerLayer` respects `allowSyntheticTimelines` |
| Clear demo labeling | 🟡 Partial | `DemoDataBadge`, `ExecutiveDemoBanner` exist |

**Production default:** `allowDemoData()` is `false` when `NODE_ENV=production` unless `STOREPILOT_ALLOW_DEMO=true`.

---

## Priority 3 — Validate Profit Calculations

| Item | Status | Notes |
|------|--------|-------|
| Google Ads profit double-count bug | ✅ Fixed | Pre-ad margin for estimated campaign profit |
| Channel comparison consistency | ✅ Fixed | ROAS vs profit status aligned after margin fix |
| Traceable profit chain | 🟡 Partial | Profit dashboard + decision waterfall exist; expand tests |
| Impossible recommendation detection | ✅ Fixed | `recommendation-validation.ts` — channel budget + optimization packages |
| Internal financial consistency tests | 🟡 In progress | `recommendation-validation.test.ts` + onboarding tests in CI |

Reference: `docs/CALCULATIONS.md`, `docs/SOURCE_TRACEABILITY.md`

---

## Priority 4 — 5-Minute Onboarding

| Item | Status | Notes |
|------|--------|-------|
| Unified onboarding wizard | ✅ Added | `/onboarding` — Shopify → Meta → Google → Advertising → Executive |
| Progress indicator | ✅ Added | Progress bar + step states on onboarding page |
| Auto-open Executive after first sync | 🟡 Partial | Completion CTA links to Executive when all steps done |
| Reduce clicks | 🟡 Partial | OAuth + account select pages exist |

**Target flow:** Install → Shopify → Meta → Google → first analysis → Executive Dashboard → first recommendation.

Extension points: `src/app/onboarding/page.tsx` (new), `ConnectionsWorkspace.tsx`, `PILOT_PROGRAM.md` checklist.

---

## Priority 5 — Help & Support

| Item | Status | Notes |
|------|--------|-------|
| In-app Help Center | 🔴 Missing | Feedback Center at `/feedback` only |
| Contextual help on major screens | 🔴 Missing | |
| Getting Started / integrations / profit docs | 🔴 Missing in-app | Engineering docs in `docs/` |

---

## Priority 6 — Beta Diagnostics

| Item | Status | Notes |
|------|--------|-------|
| Merchant-facing diagnostics panel | 🔴 Missing | |
| Integration Health page | ✅ Exists | `/integration-health` |
| Validation dashboard | ✅ Exists | `/validation` (internal) |
| Dev beta readiness | ✅ Exists | `/dev/decision-engine` (hidden in production) |

**Todo:** Compose `/settings/diagnostics` or env-gated `/diagnostics` from integration health + sync status + data quality.

---

## Priority 7 — Beta Feedback

| Item | Status | Notes |
|------|--------|-------|
| 👍/👎 on recommendations | 🟡 Partial | `RecommendationFeedback` on full `RecommendationCard` in Approval Center only |
| Feedback Center | ✅ Exists | `/feedback` — bugs, features, AI feedback |
| Reject-with-reason on decisions | ✅ Exists | `DecisionRejectFeedbackModal` |
| Feedback on Executive / Decision cards | 🔴 Todo | Extend `RecommendationFeedback` to `DecisionCard`, `DecisionMemoCard` |

---

## Priority 8 — Beta Readiness Verification

| Check | Status |
|-------|--------|
| Shopify installation succeeds | 🔴 Verify manually |
| OAuth completes | 🔴 Verify manually |
| Initial sync without errors | 🔴 Verify manually |
| Executive Dashboard loads | 🟡 Fixed perf + demo fallback |
| Advertising analysis completes | 🟡 Fixed perf + profit bug |
| AI recommendations consistent | 🟡 In progress |
| Profit calculations verified | 🟡 Margin fix shipped |
| Approval Center works | 🟡 Perf fix shipped |
| Empty states handled | 🟡 Partial |
| Error messages user-friendly | 🟡 Partial |
| Desktop + tablet | 🔴 Audit |
| Performance acceptable | 🟡 Improving |

---

## This Week — Recommended Order

1. **P0:** Segment `error.tsx` + remaining fetch abort/catch cleanup
2. **P2:** Stop hybrid simulation ads on live stores; fix DemoDataBadge
3. **P3:** Profit consistency tests + recommendation contradiction guard
4. **P4:** Minimal onboarding wizard (3 steps + progress bar)
5. **P5–P7:** Help hub MVP, diagnostics panel, extend feedback buttons

**Goal:** Build trust, not features.
