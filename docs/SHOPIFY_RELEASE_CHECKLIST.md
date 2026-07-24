# StorePilot — Shopify Release Checklist (Final Gate)

**Date:** 2026-07-24  
**Production URL:** https://storepilotai.pro  
**Railway service URL:** https://storepilot-production-d591.up.railway.app  
**Repo:** `erhanz1973-droid/storepilot` (branch `main`)  
**Linked Railway project:** `accurate-wholeness` / service `storepilot`

---

## Release recommendation

# ❌ DO NOT RESUBMIT

Do **not** change this to ✅ until every item in **Gate summary** below is checked off with evidence.

---

## Gate summary

| # | Gate | Status | Evidence |
| --- | --- | --- | --- |
| G1 | Review fixes committed | ❌ FAIL | Many modified/untracked files still local (see §1) |
| G2 | Review fixes deployed to Railway | ❌ FAIL | Live `/api/demo/scenario` returns **200** + synthetic KPIs |
| G3 | `STOREPILOT_ALLOW_DEMO` absent/false | ✅ PASS | Absent on Railway (no demoish env keys) |
| G4 | `NODE_ENV=production` explicit | ⚠️ WARN | Not set in Railway variables UI (Next usually injects at runtime — set explicitly) |
| G5 | Required prod secrets present | ✅ PASS* | Shopify + encryption + Meta + Google Ads + Supabase service role set (*see gaps) |
| G6 | Production cannot reach demo functionality | ❌ FAIL | Public GET `/api/demo/scenario` → 200 with `revenue30d: 82400` |
| G7 | Fresh-store smoke test complete | ❌ FAIL | Not executed against post-fix deploy |

\*Optional/secondary gaps: `META_APP_URL`, `GOOGLE_ADS_APP_URL`, `GA4_*`, `SMOKE_SECRET`, `SUPABASE_ANON_KEY` unset (fallbacks may apply).

---

## 1. Uncommitted Shopify review fix files

**Status: ❌ Must commit + push before deploy**

### Modified (review-critical)

```
src/lib/env/runtime.ts
src/lib/store/context.ts
src/lib/demo/is-demo-store.ts
src/lib/connectors/plugins/shopify.ts
src/lib/connectors/plugins/demo.ts
src/lib/connectors/registry.ts
src/lib/commerce/providers/shopify.ts
src/lib/commerce/normalize.ts
src/lib/integrations/confidence.ts
src/lib/api/route-auth.ts
src/app/api/demo/scenario/route.ts
src/lib/services/embedded-executive-fallback.ts
src/lib/services/analytics.ts
src/lib/analytics/order-intelligence.ts
src/lib/analytics/revenue-studio.ts
src/lib/customers/engine.ts
src/lib/products/catalog-enrichment.ts
src/lib/attribution/product-mapping.ts
src/lib/recommendations/registry.ts
src/lib/db/learning.ts
src/lib/learning/learning-cron-stores.ts
src/components/DemoDataBadge.tsx
src/components/commerce/CommerceEmptyState.tsx
src/app/analytics/executive/page.tsx
src/lib/first-run/gate.ts
src/lib/trust/data-mode.ts
src/lib/validation/app-store-readiness.ts
src/lib/recommendations/repository.ts
```

### Untracked (include with release)

```
docs/SHOPIFY_APP_REVIEW_FIX_REPORT.md
docs/SHOPIFY_APP_REVIEW_COMPLIANCE_AUDIT.md
docs/SHOPIFY_RELEASE_CHECKLIST.md   (this file)
```

### Do not treat as release blockers (but decide explicitly)

- `tsconfig.tsbuildinfo` — build artifact; prefer not commit  
- `store-pilot/` — separate Remix tree; confirm whether it belongs in this deploy  
- Additional `src/lib/demo/alpine-outfitters/**`, `provider.ts`, `showcase-overrides.ts` — demo fixtures for **dev-only**; safe if `allowDemoData()` hard-kills in production after deploy

**Action:** Commit review fixes → push `main` → confirm Railway auto-deploy finishes → re-probe §3.

---

## 2. Railway deployment checklist

### Pre-deploy

- [ ] Commit all review-critical files listed above  
- [ ] Push to `main` (Railway watches this repo)  
- [ ] Confirm deploy status Online for service `storepilot`  
- [ ] Set Railway variable **`NODE_ENV=production`** explicitly (recommended)  
- [ ] Confirm **`STOREPILOT_ALLOW_DEMO` is unset** or `false` (currently unset ✅)  
- [ ] Confirm **`INTEGRATIONS_DEMO` unset or `false`**  
- [ ] Confirm **`STOREPILOT_ALLOW_SYNTHETIC_ATTRIBUTION` unset or not `true`**  
- [ ] Align public URL: app is served at `https://storepilotai.pro` while `SHOPIFY_APP_URL` / `NEXT_PUBLIC_APP_URL` still point at `https://storepilot-production-d591.up.railway.app` — verify Shopify Partner app URLs / OAuth redirects match the URL reviewers use  

### Required production environment variables

| Variable | Required for App Store Shopify path | Railway status (2026-07-24 probe) |
| --- | --- | --- |
| `NODE_ENV` | Yes (explicit recommended) | ⚠️ MISSING in vars UI |
| `STOREPILOT_ALLOW_DEMO` | Must be absent or `false` | ✅ ABSENT |
| `SHOPIFY_API_KEY` | Yes | ✅ SET |
| `SHOPIFY_API_SECRET` | Yes | ✅ SET |
| `SHOPIFY_APP_URL` | Yes | ✅ SET |
| `NEXT_PUBLIC_APP_URL` | Yes | ✅ SET |
| `SHOPIFY_TOKEN_ENCRYPTION_KEY` (≥32) | Yes | ✅ SET (len 64) |
| `META_TOKEN_ENCRYPTION_KEY` (≥32) | Yes (readiness) | ✅ SET |
| `GOOGLE_ADS_TOKEN_ENCRYPTION_KEY` (≥32) | Yes (readiness) | ✅ SET |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (DB) | ✅ SET |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (DB) | ✅ SET |
| `CRON_SECRET` | Yes (cron) | ✅ SET |
| `STOREPILOT_INTERNAL_SECRET` | Recommended | ✅ SET |
| `META_APP_ID` / `META_APP_SECRET` | For Meta connect | ✅ SET |
| `GOOGLE_ADS_CLIENT_ID` / `SECRET` / `DEVELOPER_TOKEN` | For Google connect | ✅ SET |
| `INTEGRATIONS_DEMO` | Prefer unset/`false` | ✅ ABSENT |
| `STOREPILOT_ALLOW_SYNTHETIC_ATTRIBUTION` | Must not be `true` | ✅ ABSENT |

### Post-deploy verification commands

```bash
# Must be 404 after fix deploy (demo disabled in production)
curl -i https://storepilotai.pro/api/demo/scenario
curl -i https://storepilot-production-d591.up.railway.app/api/demo/scenario

# Must NOT contain Peak / Alpine / demo.storepilot / showcase revenue
curl -s https://storepilotai.pro/api/demo/scenario | head
```

**Current live result (pre-fix deploy):** both URLs return **HTTP 200** with synthetic scenario JSON including `revenue30d: 82400`. That is a **release blocker**.

---

## 3. Production route → demo reachability

| Route / path | Expected after fix deploy | Live now |
| --- | --- | --- |
| `GET /api/demo/scenario` | 404 JSON error | ❌ 200 + fake KPIs |
| `POST /api/demo/scenario` | 404 (and not public) | Not re-probed; assume same build |
| `allowDemoData()` in `NODE_ENV=production` | Always `false` | Code local ✅; **not on live build** |
| Dashboard without shop context | Connect / empty — never Alpine | Requires post-deploy smoke |

Code gates (local tree, after commit/deploy):

- `src/lib/env/runtime.ts` — hard deny demo in production  
- `src/lib/api/route-auth.ts` — `/api/demo` public only when `allowDemoData()`  
- `src/app/api/demo/scenario/route.ts` — returns 404 when demo off  
- `src/lib/demo/is-demo-store.ts` — always false in production  

---

## 4. Smoke test — brand-new Shopify development store

Run **only after** G1+G2 pass (fixes deployed and demo API returns 404).

### Setup

1. Create a **new** Shopify development store (Partner Dashboard).  
2. Prefer one with known catalog state:
   - **Store A:** ≥1 product, ≥1 order (or create a test order)  
   - **Store B (optional):** 0 products **or** 0 orders for empty-state checks  
3. Install the **production** StorePilot app (Partner app linked to production URLs).

### Steps

| Step | Action | Pass criteria |
| --- | --- | --- |
| 1 | Install app from Shopify Admin | Install completes without error |
| 2 | Complete OAuth | Redirects to app; no `oauth_*` error query |
| 3 | Land on first-run / dashboard | Embedded app loads for **this** shop |
| 4 | Verify shop name | Exact Admin shop name / `.myshopify.com` domain — **not** Alpine, Peak, Summit Supply, Demo Store |
| 5 | Verify products | Titles match Shopify Admin catalog |
| 6 | Verify orders / revenue | Matches Admin (or `$0` / empty if none) — **not** ~$82k showcase figures |
| 7 | Zero-order store | UI shows **“No orders yet”** (or equivalent professional empty) — never fabricated revenue |
| 8 | Zero-product store | UI shows **“No products imported”** — never fake catalog |
| 9 | Global string sweep | Search UI + network responses for: `Peak Outfitters`, `Alpine`, `demo.storepilot.ai`, `Demo Mode`, `Summit Supply` — **zero hits** |
| 10 | Demo API | `GET /api/demo/scenario` → **404** |
| 11 | Meta/Google disconnected | Connect empty states only — no synthetic ROAS/spend |

### Fail immediately if

- Any Peak / Alpine / `*.demo.storepilot.ai` branding  
- Public demo API returns scenarios or revenue  
- Dashboard shows non-zero revenue with zero Shopify orders  
- Shop context resolves to another merchant  

**Smoke status today:** ❌ Not run (blocked on undeployed fixes + live demo API).

---

## 5. Actions to reach ✅ READY FOR SHOPIFY RESUBMISSION

1. Commit + push review fixes.  
2. Wait for Railway deploy success.  
3. Set `NODE_ENV=production` on Railway (explicit).  
4. Re-probe: `/api/demo/scenario` must be **404** on both hostnames.  
5. Complete smoke test §4 on a fresh development store; record screenshots/notes.  
6. Only then flip recommendation to:

```text
✅ READY FOR SHOPIFY RESUBMISSION
```

---

## 6. Verdict policy (non-negotiable)

This document must keep:

```text
❌ DO NOT RESUBMIT
```

until **G1–G7** are all ✅.  
Partial code readiness is **not** sufficient while production still serves demo scenario KPIs.
