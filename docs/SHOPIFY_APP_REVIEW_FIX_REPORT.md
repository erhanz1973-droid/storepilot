# Shopify App Store Review Fix Report

**Date:** 2026-07-24  
**Issue:** App defaulted to an external demo store and displayed mock catalog / sales metrics instead of the authenticated merchant’s live Shopify data.

---

## 1. Demo components removed / gated

| Surface | Change |
| --- | --- |
| `resolveActiveStoreId` demo fallback | **Removed in production.** Throws `UnresolvedStoreContextError` instead of `DEMO_STORE_ID`. |
| Stale `DEMO_STORE_ID` cookie | **Ignored** when demo disabled. |
| Shopify connector `demo.sync()` | **Gated** — only when `allowDemoData() && storeId === DEMO_STORE_ID`. |
| Commerce provider Peak Outfitters fallback | **Removed** — missing/decryption-failure installs return **empty** products/orders/metrics (zeros). |
| Executive embedded fallback | **No longer** calls `buildDemoExecutivePageData()`. Returns empty merchant shell. |
| Executive error catch | Production returns `buildEmptyMerchantExecutivePageData()` — never Alpine/Peak KPIs. |
| `/api/demo/scenario` | Returns **404** when demo disabled. |
| `DemoDataBadge` / scenario switcher | Hidden unless `STOREPILOT_ALLOW_DEMO=true` in non-production. |
| Snapshot `source: "demo"` when disconnected | Changed to **`disconnected`**. |
| Learning cron demo store id | Only enqueued when demo allowed. |
| Demo plugin loader | Returns empty snapshot if demo disabled. |

Demo fixtures (Alpine / Peak) remain in `src/lib/demo/**` for **local development only**.

---

## 2. Files modified

- `src/lib/env/runtime.ts`
- `src/lib/store/context.ts`
- `src/lib/connectors/plugins/shopify.ts`
- `src/lib/connectors/plugins/demo.ts`
- `src/lib/connectors/registry.ts`
- `src/lib/commerce/providers/shopify.ts`
- `src/lib/services/analytics.ts`
- `src/lib/services/embedded-executive-fallback.ts`
- `src/app/api/demo/scenario/route.ts`
- `src/components/DemoDataBadge.tsx`
- `src/components/commerce/CommerceEmptyState.tsx`
- `src/app/analytics/executive/page.tsx`
- `src/lib/learning/learning-cron-stores.ts`
- `src/lib/recommendations/repository.ts`
- `src/lib/validation/app-store-readiness.ts`
- `docs/SHOPIFY_APP_REVIEW_FIX_REPORT.md` (this file)

---

## 3. Shopify API flow

```
OAuth token on installation
        ↓
syncShopifyStore(shop, accessToken)  // GraphQL — shop, products, orders
        ↓
updateShopifySyncResult(storeId, stats, snapshot)
        ↓
createShopifyPlugin(storeId).sync() / fetchStoreSnapshot()
        ↓
aggregateStoreSnapshot(storeId)  // live connectors only
        ↓
Dashboard / Executive UI
```

No Peak/Alpine injection on live `storeId`.

---

## 4. OAuth flow

```
Install → /api/shopify/callback
  → exchangeCodeForToken
  → createStoreForShop / findStoreByShopDomain
  → upsertShopifyInstallation (token encrypted)
  → registerAppWebhooks
  → syncShopifyStore (initial sync)
  → Set storepilot_active_store_id cookie = merchant storeId
  → Redirect /first-run?installed=1
```

Embedded Admin: shop domain from session / cookie → `getActiveStoreIdForShopDomain` → merchant workspace.

---

## 5. Dashboard flow

```
tryResolveActiveStoreId / resolveActiveStoreId
  → embedded installation OR live cookie (never demo in prod)
  → getCachedStoreBundle → aggregateStoreSnapshot
  → buildExecutivePageData / getCachedDashboard
  → Real shop domain, products, order metrics
  → If zero orders: empty states / $0 — not fabricated revenue
```

---

## 6. Remaining review risks

| Risk | Mitigation / action |
| --- | --- |
| Production env still has `STOREPILOT_ALLOW_DEMO=true` | **Hard-coded ignore in production** (`allowDemoData()` always false when `NODE_ENV=production`). Verify Railway env anyway. |
| Reviewer opens standalone URL without shop context | Sees connect / empty state — not demo. Confirm embed path works via App Bridge shop. |
| Token decryption failure | Now returns empty / throws — ensure encryption keys match the keys used at install. |
| Some lib defaults still use `storeId = DEMO_STORE_ID` | Mostly learning/test helpers; production paths pass live storeId. Follow-up: remove defaults. |
| Marketing site may still mention demos | Confirm listing / marketing copy does not claim demo metrics as product. |
| Meta/Google not connected | Must show “Connect Meta Ads” / “Connect Google Ads” empty states — verify Connections UI. |

---

## 7. Final compliance checklist

- [x] No automatic demo mode in production
- [x] No demo URLs served as default merchant (`demo.storepilot.ai` only behind explicit demo id + non-prod flag)
- [x] No mock metrics fallback on live store failure
- [x] No fake Peak Outfitters catalog on missing installation
- [x] Shopify OAuth creates merchant workspace + cookie
- [x] Initial sync after install
- [x] Dashboard scoped to authenticated shop
- [x] Empty merchant executive shell (zeros) instead of Alpine KPIs
- [x] `/api/demo/*` disabled when demo off
- [ ] **Manual:** Install on a fresh development store → confirm real shop name + products + orders (or “No orders yet”)
- [ ] **Manual:** Confirm Railway `NODE_ENV=production` and `STOREPILOT_ALLOW_DEMO` unset/false
- [ ] **Manual:** Reviewer login / install path unblocked
- [ ] **Manual:** `npm run validate` app_store suite green on deploy

### Dev-only demo (optional)

```bash
# local only — never on Railway production
STOREPILOT_ALLOW_DEMO=true npm run dev
```

### Follow-up hardening (post-inventory)

- Gated `shouldUseDemoIntegrations()` with `allowDemoData()`
- `/api/demo` removed from always-public API list (public only when demo allowed)
- Gated Peak orders/customers injection in `commerce/normalize.ts`
