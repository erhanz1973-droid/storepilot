# Production Verification Report — Demo API Blocker

**Date:** 2026-07-24  
**Production hosts:** `https://storepilotai.pro`, `https://storepilot-production-d591.up.railway.app`  
**Commits deployed:**
- `1c76c14` — Block Shopify App Store rejection (demo kill + store scoping)
- `1b9bec9` — Return 404 from demo APIs instead of middleware 401  

**Railway deployment:** `90f63988-e135-4ec0-9fd5-d5e763fed3bd` (SUCCESS)

---

## 1. Root cause

| Hypothesis | Result |
| --- | --- |
| Fix never committed | **Yes** — `origin/main` still had ungated `/api/demo/scenario` at `6ac161b` |
| Fix never deployed | **Yes** — followed from uncommitted local changes |
| Cached response | **No** — Cloudflare `cf-cache-status: DYNAMIC`; behavior changed after deploy |
| Routed incorrectly | **No** — same Next route on both hostnames |
| Production route still registered without gate | **Yes (pre-fix)** — route existed and returned synthetic KPIs |

**Conclusion:** The production exposure was **undeployed local fixes**, not cache or misrouting.

---

## 2. What was done

1. Confirmed remote `main` lacked `allowDemoData()` / production 404 on demo route.  
2. Committed and pushed review fixes (`1c76c14`).  
3. Set Railway `NODE_ENV=production` (was unset in variables UI).  
4. First deploy made `/api/demo` non-public → probes got **401** (no demo body, but not the required 404/403).  
5. Follow-up commit `1b9bec9`: allow `/api/demo` through middleware; handler returns **404** when production / demo disabled.  
6. Verified live after deploy `90f63988…`.

---

## 3. Live verification results

### Demo API

| Request | Host | HTTP | Body |
| --- | --- | --- | --- |
| `GET /api/demo/scenario` | storepilotai.pro | **404** | `{"error":"Not found"}` |
| `POST /api/demo/scenario` | storepilotai.pro | **404** | `{"error":"Not found"}` |
| `GET /api/demo/scenario` | railway.app hostname | **404** | `{"error":"Not found"}` |

**Before deploy:** HTTP **200** with `healthy_growth` / `revenue30d: 82400`.

### Environment (Railway production)

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `STOREPILOT_ALLOW_DEMO` | absent |
| `INTEGRATIONS_DEMO` | absent |
| `STOREPILOT_ALLOW_SYNTHETIC_ATTRIBUTION` | absent |

### Other public / semi-public probes (no Peak / Alpine / fake revenue payload)

| Path | HTTP | Demo payload |
| --- | --- | --- |
| `/api/debug` | 401 | none |
| `/api/validation` | 500 | none |
| `/api/dev` | 404 | none |
| `/api/cron` | 404 | none |
| `/api/internal` | 404 | none |
| `/` (marketing/home) | 200 | no Peak/Alpine/demo.storepilot strings |

---

## 4. Production access to demo APIs

- Handler: `demoAllowed()` requires non-production **and** `STOREPILOT_ALLOW_DEMO=true`.  
- In production: always **404**.  
- No synthetic KPIs, Peak Outfitters, Alpine, or showcase revenue returned from `/api/demo/*` on live hosts.

---

## 5. App Store release recommendation

### Demo production blocker: **CLEARED** (verified on live deployment)

### Overall Shopify resubmission:

# ❌ DO NOT RESUBMIT (yet)

**Remaining gate (from release checklist):** fresh Shopify development-store smoke test (install → OAuth → real shop name / products / orders or empty states) has **not** been executed against this deploy.

After that smoke test passes with screenshots/notes, flip to:

**✅ READY FOR SHOPIFY RESUBMISSION**

---

## 6. Evidence commands (re-run anytime)

```bash
curl -i https://storepilotai.pro/api/demo/scenario
# expect: HTTP/2 404  {"error":"Not found"}

curl -i -X POST -H 'content-type: application/json' \
  -d '{"scenarioId":"healthy_growth"}' \
  https://storepilotai.pro/api/demo/scenario
# expect: HTTP/2 404
```
