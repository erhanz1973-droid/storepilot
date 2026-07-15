# Alpha Onboarding Report

**Sprint:** Alpha First-Run Experience  
**Date:** 2026-07-14  
**Scope:** Optimize Time-To-Value for a new Shopify merchant’s first ~10 minutes. No new AI models, no extra chart dashboards.

---

## UX flow — before vs after

### Before

1. Shopify OAuth completes (blocking catalog sync).
2. Redirect to `/connections?tab=commerce&installed=1` (technical success banner).
3. Merchant opens Executive `/` — recommendations are **not** regenerated (`skipRecommendationSync`).
4. First recommendation often appears only after Approvals/History triggers `ensureRecommendationsSynced`.
5. Empty modules often say “No data” without next steps.

### After

1. Shopify OAuth completes + funnel events `installation_completed` / `shopify_connected`.
2. Redirect to `/first-run?installed=1`.
3. Welcome copy → staged analysis progress → `ensureRecommendationsSynced` via `/api/first-run/analyze`.
4. Full-screen **one** executive decision (Approve / See Why / Not now).
5. Soft-gate: live Shopify stores that haven’t finished first-run are redirected from Executive to `/first-run`.
6. Existing `/onboarding` wizard remains for multi-connector setup after first value.

---

## Screens changed

| Screen | Change |
|--------|--------|
| Shopify OAuth callback | Redirect → `/first-run?installed=1` |
| `/first-run` | New guided first-run experience |
| `/` Executive | Soft-gate to `/first-run` when incomplete |
| Meta / Google connection panels | Informative empty states |
| Commerce empty state | Why + next step + CTA |
| History / Decisions / Intelligence empties | Advisor-style copy |
| Executive demo / integration banners | Point toward first-run |
| `/internal/alpha` | Internal alpha funnel metrics |

---

## Components / libs changed

**New**

- `src/components/first-run/FirstRunExperience.tsx`
- `src/components/first-run/FirstRunProgress.tsx`
- `src/components/first-run/FirstRunDecisionCard.tsx`
- `src/components/first-run/FirstRunWhyPanel.tsx`
- `src/components/first-run/FirstRunApprovePreview.tsx`
- `src/lib/first-run/analyze.ts`
- `src/lib/first-run/gate.ts`
- `src/lib/first-run/types.ts`
- `src/lib/analytics/alpha-funnel.ts`
- `src/lib/analytics/alpha-metrics.ts`
- `src/app/api/first-run/analyze|track|complete`
- `src/app/api/internal/alpha` (+ session unlock)
- Migration `20260714130000_alpha_funnel_events.sql`

**Updated**

- `EmptyState` (+ reason / nextStep / cta)
- Shopify callback, embedded afterAuth tracking
- Decisions action API (`source`, funnel events)
- AppNav hides on `/first-run` and `/internal/alpha`

---

## Analytics events added

| Event | When |
|-------|------|
| `installation_completed` | OAuth / embedded install persist |
| `shopify_connected` | Same |
| `first_run_opened` | First-run client mount |
| `first_recommendation_shown` | Analyze returns a decision |
| `see_why_clicked` | See Why |
| `recommendation_approved` / `recommendation_rejected` | Decisions API |
| `first_run_completed` | Complete endpoint / cookie |
| `ttv_recommendation_ms` / `ttv_approval_ms` | Derived from `shopify_connected` |

Internal dashboard: `/internal/alpha?token=$STOREPILOT_INTERNAL_SECRET` (sets httpOnly cookie) or `GET /api/internal/alpha` with Bearer secret.

**Apply migration** `alpha_funnel_events` on production Supabase before relying on persisted metrics (in-memory fallback exists if insert fails).

---

## Empty states improved

- Commerce, Meta, Google, History, Decisions, Intelligence “needs improvement”
- Pattern: **why missing** + **what StorePilot will do next** + optional CTA

---

## Estimated Time-To-Value

| Metric | Before (approx) | After (target) |
|--------|-----------------|----------------|
| Time to first recommendation | After navigating Approvals; Executive read path skips sync | During `/first-run` analyze (~1–2 min post-connect) |
| Time to first executive decision | Buried in dashboard chrome | Immediate one-decision screen |
| Time to first Approve | Requires finding Approvals UI | Primary CTA on first-run |

Instrument actuals via alpha funnel for developer alpha.

---

## Improvements made

- Dedicated calm welcome + real analysis stages tied to snapshot counts and recommendation sync.
- One recommendation / one decision — not a dashboard dump.
- Grounded See Why (products / orders / campaigns + store evidence).
- Immediate “what happens if you approve” preview.
- First-party funnel + internal alpha metrics page.
- High-traffic empty states explain gaps and next actions.

---

## Remaining friction points

1. **Ads-dependent recommendations:** Commerce-only stores may still finish first-run with an empty outcome until Meta/Google (or richer costs) are connected — empty state CTA covers this, but value feels lower without ads.
2. **Migration dependency:** Funnel metrics stay incomplete until `alpha_funnel_events` is applied in Supabase.
3. **Embedded Admin routing:** afterAuth cannot HTTP-redirect; soft-gate on Executive covers returning to `/`, but first paint in Admin may still flash before gate.
4. **Blocking analyze cost:** `ensureRecommendationsSynced` can take tens of seconds on larger catalogs — progress UI helps, but timeout/`maxDuration` should be watched in Railway.
5. **Demo stores:** Soft-gate skips demo/simulation so internal demos still open Executive; merchants must use a live install path to see first-run.

---

## Recommendations before developer alpha testing

1. Apply `20260714130000_alpha_funnel_events.sql` (and executive memory migration if not already) on the alpha Supabase project.
2. Deploy StorePilot with this branch; smoke: OAuth → `/first-run` → 401-free analyze → Approve → `/approvals`.
3. Open `/internal/alpha?token=…` and confirm events after one sandbox install.
4. Test a **Shopify-only** store and a **Shopify+Meta** store to compare empty vs decision outcomes.
5. Confirm Railway/Vercel `maxDuration` for `/api/first-run/analyze` is ≥ 120s.
6. Do **not** start new AI feature work until alpha reports time-to-first-recommendation and approval rate.

---

## Acceptance checklist

- [x] Merchant understands what StorePilot is doing (welcome + stages)
- [x] First recommendation generation triggered quickly in first-run
- [x] See Why grounded in store stats
- [x] Empty states informative
- [x] Analytics cover the first-run journey
- [x] First 10 minutes feel like executive onboarding, not a reporting dashboard
