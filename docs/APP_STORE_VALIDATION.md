# StorePilot AI — App Store Validation (10 Phases)

**Goal:** Submit to the Shopify App Store only after all phases pass.

```bash
cd storepilot-ai
npm run validate
npm run dev   # manual checks on /validation?run=1
```

See also [CALCULATIONS.md](./CALCULATIONS.md) and [../VALIDATION.md](../VALIDATION.md).

---

## Phase 1 — Verify Data Accuracy

Validate KPIs against original API responses.

**Shopify:** Revenue, orders, refunds, discounts, taxes, shipping, products, inventory, customers — from GraphQL sync (`lib/shopify/sync.ts`).

**Meta:** Spend, impressions, clicks, CTR, CPC, CPM, purchases, purchase value, ROAS — from Graph Insights (`lib/meta/sync.ts`). Cross-check via `/api/validation/meta`.

**Google:** Spend, impressions, clicks, CTR, CPC, conversions, conversion value, ROAS — from GAQL (`lib/google-ads/api.ts`).

**GA4:** **Not live** — do not claim in App Store listing until Data API connector ships.

---

## Phase 2 — Validate Calculations

`npm run validate` runs profit (0% tolerance), ROAS, attribution confidence suites.

Full formulas: [CALCULATIONS.md](./CALCULATIONS.md).

---

## Phase 3 — Cross Check

Compare same date range: StorePilot vs Shopify Analytics, Meta Ads Manager, Google Ads, GA4 (when live).

Document attribution window differences for ad platforms.

---

## Phase 4 — API Validation

| Integration | OAuth | Webhooks | Sync | Errors |
|-------------|-------|----------|------|--------|
| Shopify | ✓ | `app/uninstalled` | Historical + manual incremental | GraphQL errors thrown |
| Meta | ✓ | — | `/api/meta/sync` | Token refresh needed |
| Google | ✓ + refresh | — | `/api/google/sync` | Developer token required |

Production env:
```env
INTEGRATIONS_DEMO=false
SHOPIFY_TOKEN_ENCRYPTION_KEY=<32+ chars>
META_TOKEN_ENCRYPTION_KEY=<32+ chars>
GOOGLE_ADS_TOKEN_ENCRYPTION_KEY=<32+ chars>
```

---

## Phase 5 — Empty States

Missing connector → show "—" and connect hint, **never fabricated numbers**.

Verified areas: executive KPIs, traffic, customers, live dashboard, profit placeholders.

---

## Phase 6 — Error Handling

Expired tokens, missing permissions, rate limits, empty stores, API downtime, partial sync — verify on `/connections` and integration health grid.

---

## Phase 7 — Performance

Automated budgets: profit 500ms, ROAS 300ms, attribution 800ms @ 50K orders.

Dashboard reads sync cache; trigger sync on connect.

---

## Phase 8 — Security

OAuth HMAC, encrypted tokens (AES-256-GCM), no client secrets, webhook verification, uninstall cleanup.

Production fails if encryption keys missing.

---

## Phase 9 — Shopify App Store Checklist

- [ ] OAuth flow on production domain
- [ ] Uninstall webhook
- [ ] Privacy Policy + Terms of Service URLs
- [ ] Support contact
- [ ] Billing (if applicable)
- [ ] GDPR / data deletion
- [ ] Responsive UI
- [ ] No console errors on core flows
- [ ] Listing matches live integrations only

---

## Phase 10 — Final Acceptance

Submit only when:

- [ ] `npm run validate` passes (including `app_store` suite)
- [ ] Pilot store cross-checks complete
- [ ] No fake data in production
- [ ] Shopify + Meta + Google connectors verified
- [ ] Performance acceptable
- [ ] Legal + security complete
