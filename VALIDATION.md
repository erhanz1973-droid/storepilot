# StorePilot AI — Validation Guide

**Feature freeze active.** Reports MVP is complete. No new features — validation and App Store readiness only.

- **[docs/RC1.md](./docs/RC1.md)** — Release Candidate checklist
- **[docs/METRIC_VALIDATION_TABLE.md](./docs/METRIC_VALIDATION_TABLE.md)** — Phase 1
- **[docs/CALCULATION_REGISTRY.md](./docs/CALCULATION_REGISTRY.md)** — Phase 2
- **[docs/SOURCE_TRACEABILITY.md](./docs/SOURCE_TRACEABILITY.md)** — Phase 3
- **[docs/CROSS_VALIDATION.md](./docs/CROSS_VALIDATION.md)** — Phase 4 pilot log
- **[docs/APP_STORE_VALIDATION.md](./docs/APP_STORE_VALIDATION.md)** — Phases 1–10 overview

Before App Store submission, complete **docs/RC1.md**.

## Quick start

```bash
cd storepilot-ai
npm install
npm run validate          # automated test suite
npm run dev               # then open /validation?run=1
```

API: `POST /api/validation` or `GET /api/validation?run=1`

---

## 1. Technical validation suite

| Suite | What it verifies |
|-------|------------------|
| **profit** | Manual net profit vs `computeProfitDashboard` — **0% tolerance** |
| **roas** | Blended ROAS for today, yesterday, 7d, 30d |
| **attribution** | Confidence levels for UTM complete, missing UTM, missing Meta, organic, multi-touch |
| **ai_reasoning** | Every recommendation has metrics, confidence, impact, reason |
| **performance** | Engine timing at 100 / 1K / 5K / 50K synthetic orders |
| **integrations** | Connector health checks + env credential detection |
| **app_store** | Production demo policy, encryption keys, OAuth config, GA4 status |
| **metrics** | Metric registry completeness and RC1 gate |

### Performance budgets (warn if exceeded)

| Engine | Budget |
|--------|--------|
| Profit | 500ms |
| ROAS | 300ms |
| Attribution | 800ms |

---

## 2. Integration validation checklist

For each connected store, manually verify:

- [ ] Shopify OAuth + initial sync
- [ ] Meta Ads OAuth + campaign sync
- [ ] Google / TikTok / Klaviyo / GA4 (when credentials set)
- [ ] Incremental sync after new orders
- [ ] Graceful handling of missing data
- [ ] Rate limit backoff (Meta Graph API)
- [ ] Expired token re-auth flow

---

## 3. Go / No-Go criteria

Public launch requires **all** of:

- ✅ Profit calculations match manual (automated)
- ✅ ROAS calculations accurate (automated)
- ✅ Attribution confidence behaves correctly (automated)
- ✅ AI recommendations evidence-based (automated)
- ✅ Dashboard performance acceptable at 50K orders (automated)
- ✅ Pilot merchants report better decisions (manual — see PILOT_PROGRAM.md)
- ✅ Recommendation acceptance rate consistently high (tracked in `/validation`)

---

## 4. Merchant feedback

Every recommendation card includes **👍 Helpful / 👎 Not Helpful**.

Not Helpful requires a reason — stored in `recommendation_feedback` for AI quality improvement.

---

## 5. Real store testing

Use `/validation` after connecting a live Shopify store. Compare:

1. StorePilot net profit (30d) vs your spreadsheet
2. Blended ROAS vs ad platform totals + Shopify revenue
3. Top recommendation — does evidence match your intuition?

Document discrepancies in pilot weekly feedback.

---

## Environment

| Variable | Purpose |
|----------|---------|
| `VALIDATION_ADMIN` | Set `false` to hide validation nav in production builds (optional) |
| `INTEGRATIONS_DEMO` | Demo integration data — **must be `false` in production** |
| `STOREPILOT_ALLOW_DEMO` | Allow demo store/fixtures — **must not be `true` in production** |
| `SHOPIFY_TOKEN_ENCRYPTION_KEY` | Required in production (≥32 chars) |
| `META_TOKEN_ENCRYPTION_KEY` | Required in production (≥32 chars) |
| `GOOGLE_ADS_TOKEN_ENCRYPTION_KEY` | Required in production (≥32 chars) |
