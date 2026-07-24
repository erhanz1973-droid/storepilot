# Final Shopify App Review Compliance Audit

**Date:** 2026-07-24  
**Scope:** `/Users/macbookpro/Documents/storepilot` (Next.js App Store candidate)  
**Method:** Full-repo search + production path tracing + runtime-gate verification  
**Status after audit fixes:** Code paths hardened; Railway live env + smoke install still required before resubmit.

---

## Executive verdict

# ❌ DO NOT RESUBMIT

### Blocking issues (must clear before resubmit)

1. **Railway production configuration not verified from this audit**  
   Confirm on Railway: `NODE_ENV=production`, `STOREPILOT_ALLOW_DEMO` unset/false, encryption keys match install tokens, no demo env vars.

2. **Fresh-install smoke test not executed against the deployed build**  
   A reviewer simulation (Install → OAuth → Dashboard → real shop name/products/orders or empty states) must pass on production URL.

3. **Audit found and fixed a critical production path during this pass**  
   `buildOrderIntelligenceRows` previously injected Peak Outfitters fake order rows for live merchants without customer history. Fix is in tree but **not yet deployed**. Do not resubmit on the old build.

Clear (1)+(2) on a build that includes this audit’s fixes → then flip to ready.

---

## A. Demo components removed / gated (this + prior fix sprint)

| Item | Action |
| --- | --- |
| `resolveActiveStoreId` → `DEMO_STORE_ID` | Production throws / empty connect UI; demo only if `allowDemoData()` |
| Stale demo cookie | Ignored when demo disabled |
| Shopify plugin `demo.sync()` | Gated: `allowDemoData() && DEMO_STORE_ID` |
| Commerce provider Peak fallback on missing install / decrypt | Removed → empty zeros |
| Executive embedded fallback → Alpine KPIs | Removed → `buildEmptyMerchantExecutivePageData` |
| Executive catch → demo page | Production → empty merchant shell |
| `/api/demo/scenario` | 404 when demo off; not always-public |
| `DemoDataBadge` / scenario switcher | Hidden unless demo allowed |
| Snapshot `source: "demo"` for disconnected live | → `disconnected` |
| Integration Peak/TikTok/GA4 fixtures | `shouldUseDemoIntegrations` requires `allowDemoData()` |
| Commerce normalize Peak orders/customers | Gated |
| Customers engine Peak snapshot/orders | Gated |
| Revenue studio Peak orders | Gated |
| Catalog enrichment Peak recent orders | Gated |
| Attribution Peak campaign↔product map | Gated |
| Recommendation Alpine curated analyzers | Gated |
| Learning seed fake outcomes | Gated |
| **`buildOrderIntelligenceRows` Peak seed fallback** | **FIXED this audit** → `[]` for live empty |
| **`isDemoStoreSnapshot()`** | **Always false in production** (central kill-switch) |
| `allowDemoData()` | Hard `false` when `NODE_ENV=production` (ignores env true) |
| Data mode `demo` label | Requires `allowDemoData()` |

Demo fixtures remain under `src/lib/demo/**` for local opt-in only (`STOREPILOT_ALLOW_DEMO=true` + non-production).

---

## B. Remaining demo references (classified)

### Development only (acceptable)

| File / area | Purpose | Why safe |
| --- | --- | --- |
| `src/lib/demo/**` | Alpine/Peak fixtures | Only loaded behind `allowDemoData()` / demo plugin |
| `src/lib/connectors/plugins/demo.ts` | Demo connector | Returns empty when demo off |
| `src/lib/integrations/demo-data.ts` | Fake integration metrics | Only via `shouldUseDemoIntegrations` → gated |
| `src/app/api/demo/**` | Scenario switcher API | 404 + not public when demo off |
| `src/components/DemoDataBadge.tsx` | Banner | Returns null when demo off |
| `**/__tests__/**` | Test fixtures | Not shipped to reviewers |
| `DEMO_STORE_ID` constant | Stable UUID for local demo | Never resolved in production context |

### Production-reachable symbols that are now safe (gated / no-op)

| File | Purpose | Why safe |
| --- | --- | --- |
| `src/lib/env/runtime.ts` | Policy | Production always denies demo |
| `src/lib/store/context.ts` | Tenant resolve | No demo fallback in prod |
| `src/lib/commerce/providers/shopify.ts` | Commerce sync | Empty on failure; Peak only demo id + allow |
| `src/lib/analytics/order-intelligence.ts` | Order rows | Live empty → `[]` |
| `src/lib/demo/is-demo-store.ts` | Classifier | False in production |

### Latent / cleanup (not reviewer-visible if callers pass storeId)

| File | Issue | Risk |
| --- | --- | --- |
| `src/lib/db/*.ts`, `learning/*.ts` | Default `storeId = DEMO_STORE_ID` | Low if all call sites pass live id (verified for dashboard/analytics). Follow-up: remove defaults. |
| Bootstrap logs `source: "demo_fallback"` | Diagnostic enum still exists | Dev-only path; production logs `unresolved` |
| Remix `store-pilot/` | Separate app; DEMO uses `—` placeholders | Out of App Store Next.js path if Railway serves Next root |

### Dead / unused after audit

| Item | Note |
| --- | --- |
| Unused `getPeakOutfittersSnapshot` import in `analytics.ts` | Removed |

---

## C. Production data flow

```
Shopify Admin install
        ↓
OAuth (/api/shopify/callback)
        ↓
exchangeCodeForToken
        ↓
createStoreForShop / findStoreByShopDomain
        ↓
upsertShopifyInstallation (encrypted access token)
        ↓
registerAppWebhooks
        ↓
syncShopifyStore (GraphQL: shop, products, orders, collections)
        ↓
updateShopifySyncResult → DB cache (store-scoped)
        ↓
Set cookie storepilot_active_store_id = merchant storeId
        ↓
Embedded: shop domain → getActiveStoreIdForShopDomain
        ↓
resolveActiveStoreId (embedded | live cookie only)
        ↓
aggregateStoreSnapshot(storeId) → live Shopify/Meta/Google plugins
        ↓
Dashboard / Executive (zeros + empty states if no data)
```

No automatic demo workspace. No “first store in DB” tenant pick.

---

## D. Dashboard data sources (primary widgets)

| Widget / metric | Source | Path |
| --- | --- | --- |
| Shop name / domain | Shopify install + sync | `shopify_installations` / sync shop fields |
| Revenue 30d | Synced order rollups | `syncShopifyStore` → `storeMetrics.revenue30d` → dashboard |
| Orders 30d | Synced orders | GraphQL `orders` query → stats/metrics |
| AOV | Derived from revenue/orders | Snapshot metrics |
| Products / catalog | Synced products | GraphQL `products` → snapshot.products |
| Collections | Synced collections | GraphQL collections → snapshot.collections |
| Order intelligence table | Live: `customerSnapshot` or `commerceOrders`; else empty | **No Peak seeds in prod** |
| Meta spend / ROAS | Meta OAuth sync cache | Empty / connect CTA if disconnected |
| Google Ads | Google OAuth sync | Empty / connect CTA if disconnected |
| AI recommendations | Analyzers on live snapshot | Alpine curated **off** in prod |
| Profit / recovery | Profit engine on live snapshot + costs | Zeros when no orders/costs |

Empty states: `CommerceEmptyState` (“No products imported”, “No orders yet”), Meta/Google connect panels, executive empty merchant shell.

---

## E. Remaining risks (could still cause rejection)

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Deploy without these audit fixes | **Critical** | Deploy current tree first |
| Railway `STOREPILOT_ALLOW_DEMO=true` | Low (ignored in prod by code) | Still unset for clarity |
| Token decryption key mismatch → empty dashboard | Medium | Confirm encryption keys stable across deploys |
| Reviewer opens non-embedded URL without shop | Medium | Must see connect/empty — not Alpine |
| Default `DEMO_STORE_ID` params if a new caller omits storeId | Medium | Remove defaults in follow-up |
| Fabricated *insight copy* from analyzers on empty stores | Low–Med | Spot-check executive for invented $ impact with 0 orders |
| Console diagnostic strings containing “demo” in enum | Low | Softened; full scrub optional |

---

## F. Final compliance checklist

| Check | Status |
| --- | --- |
| No automatic demo stores in production code paths | ✅ Code |
| No demo URLs as default merchant | ✅ Code |
| No fake products on live storeId | ✅ Code |
| No fake orders (Peak seeds) on live empty merchants | ✅ Fixed this audit |
| No fake revenue fallback | ✅ Code (metrics default 0) |
| No placeholder Alpine KPI pin in prod | ✅ Gated |
| OAuth is source of truth | ✅ Code |
| Dashboard uses authenticated merchant only | ✅ Code |
| Queries scoped by storeId (no global demo workspace) | ✅ Code (defaults = latent cleanup) |
| Professional empty states present | ✅ Code |
| Initial Shopify sync on install | ✅ Code |
| `/api/demo` disabled in production | ✅ Code |
| `allowDemoData` impossible in production | ✅ Code |
| Railway env verified | ❌ Manual pending |
| Fresh install smoke on production URL | ❌ Manual pending |
| Production build deployed with audit fixes | ❌ Pending |

---

## G. Release recommendation

# ❌ DO NOT RESUBMIT

**Blocking issues:**

1. Ship/deploy the audit fixes (especially order-intelligence Peak seed removal + `isDemoStoreSnapshot` production kill-switch).  
2. Verify Railway: `NODE_ENV=production`, demo flags off, encryption keys valid.  
3. Run reviewer simulation on production: Install → OAuth → real shop name + products + real order stats or “No orders yet” — zero Alpine/Peak/demo references.

When (1)–(3) pass, change verdict to:

**✅ READY FOR SHOPIFY RESUBMISSION**

---

## Environment separation (confirmed in code)

```
allowDemoData() === true  iff
  NODE_ENV !== "production"
  AND STOREPILOT_ALLOW_DEMO === "true"
```

Production: always `false`, even if `STOREPILOT_ALLOW_DEMO=true`.

Local demo (optional):

```bash
NODE_ENV=development STOREPILOT_ALLOW_DEMO=true npm run dev
```


---

## Release gate update (2026-07-24)

See [`SHOPIFY_RELEASE_CHECKLIST.md`](./SHOPIFY_RELEASE_CHECKLIST.md).

**Live probe:** `GET https://storepilotai.pro/api/demo/scenario` returned **200** with synthetic `revenue30d` — deploy of review fixes has **not** landed. Verdict remains **❌ DO NOT RESUBMIT**.
