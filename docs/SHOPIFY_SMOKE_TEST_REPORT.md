# Shopify Review Smoke Test Report

**Date:** 2026-07-24 02:15 UTC  
**Target production:** https://storepilotai.pro  
**Railway hostname:** https://storepilot-production-d591.up.railway.app  
**App (shopify.app.toml):** StorePilot (`client_id` configured)  
**Deploy verified for demo kill:** `90f63988…` / commits `1c76c14`, `1b9bec9`

---

## Final result

# ❌ SMOKE TEST NOT COMPLETED — DO NOT RESUBMIT

Interactive install on a **brand-new Shopify development store** could not be executed from this agent environment.

| Requirement | Status |
| --- | --- |
| Create / use brand-new never-installed Shopify development store | ❌ Blocked |
| Install app | ❌ Blocked |
| Complete OAuth | ❌ Blocked |
| Verify installation record | ❌ Not run |
| Verify access token stored | ❌ Not run |
| Verify initial sync | ❌ Not run |
| Dashboard: real shop name / products / orders / empty states | ❌ Not run |
| Confirm no Peak / Alpine / synthetic KPIs | ⚠️ Partial (public demo API only) |
| Screenshots of each step | ❌ Not captured |

**Release recommendation remains:**

# ❌ DO NOT RESUBMIT

Do **not** change to ✅ READY FOR SHOPIFY RESUBMISSION until a human (or interactive local session) completes §3 and every row is Pass.

---

## 1. Why this environment cannot finish the smoke test

1. **OAuth + Admin install requires an interactive Shopify Partner / store session** (browser login, approve scopes).  
2. This agent session has **no browser automation MCP** and cannot complete Partner Dashboard / Admin UI flows.  
3. Shopify CLI here is **non-interactive** (`Failed to prompt` when auth/config needs a TTY).  
4. Existing scripts (`npm run smoke:production`, `scripts/verify-shopify-connection.mjs`) validate **already-installed** shops via Supabase + API — they do **not** create a never-installed development store or drive OAuth.

---

## 2. What was verified without a new-store install

| Check | Result | Evidence |
| --- | --- | --- |
| Production demo API disabled | ✅ Pass | `GET/POST https://storepilotai.pro/api/demo/scenario` → **404** `{"error":"Not found"}` |
| Railway demo API disabled | ✅ Pass | Same on `storepilot-production-d591.up.railway.app` |
| `STOREPILOT_ALLOW_DEMO` | ✅ Absent | Railway variables probe |
| `NODE_ENV` | ✅ `production` | Railway variables probe |

This clears the **public demo metrics** blocker only. It does **not** satisfy the merchant install smoke gate.

---

## 3. Manual smoke runbook (must be completed before READY)

Use a **new** Partner development store that has **never** installed StorePilot.

### A. Create store

1. Partner Dashboard → Stores → Add store → Development  
2. Note: `{{shop}}.myshopify.com`

### B. Install + OAuth

1. Open install URL for production app (Partner app → Test on development store), or  
   `https://{{shop}}.myshopify.com/admin/oauth/install?client_id=…` via Partner “Select store”.  
2. Approve scopes.  
3. Confirm redirect lands on StorePilot (first-run or dashboard) embedded in Admin.

**Screenshot:** OAuth consent + post-install app shell.

### C. Database / token / sync (Railway or Supabase)

With service role (read-only):

```sql
-- installation for the new shop
select id, store_id, shop_domain, status, connection_health,
       last_sync_at, installed_at,
       (access_token_encrypted is not null) as has_token
from shopify_installations
where shop_domain = 'YOURSHOP.myshopify.com'
  and status = 'active';
```

Pass criteria:

- [ ] Row exists  
- [ ] `has_token = true`  
- [ ] `last_sync_at` set (or sync triggered and completes within ~1–2 min)  
- [ ] Linked `stores` row for `store_id`

Optional CLI (after install only):

```bash
cd /Users/macbookpro/Documents/storepilot
SHOP_DOMAIN=YOURSHOP.myshopify.com railway run node scripts/verify-shopify-connection.mjs
```

**Screenshot:** query result (redact token material — only `has_token` / health).

### D. Dashboard UI

| Condition | Expected |
| --- | --- |
| Shop identity | Real shop name / domain — **not** Alpine, Peak, Summit Supply, Demo Store |
| Has products | Real titles from Admin |
| Has orders | Real order stats from Admin |
| Zero products | **“No products imported”** (or equivalent) |
| Zero orders | **“No orders yet”** (or equivalent) — **not** fabricated revenue |

**Screenshots:** dashboard header (shop name), products area, orders/revenue area, empty states if applicable.

### E. Anti-demo sweep

Search UI + network for:

- Peak Outfitters  
- Alpine  
- `demo.storepilot.ai`  
- Demo Mode banner  
- Showcase revenues (~$82k / similar)

Also:

```bash
curl -i https://storepilotai.pro/api/demo/scenario
# must remain 404
```

**Screenshot:** empty search / 404 response.

### F. Sign-off table (fill when run)

| Step | Pass? | Screenshot filename | Notes |
| --- | --- | --- | --- |
| New store created | ☐ | | |
| Install | ☐ | | |
| OAuth complete | ☐ | | |
| Installation row | ☐ | | |
| Token stored | ☐ | | |
| Initial sync | ☐ | | |
| Real shop name | ☐ | | |
| Products / empty | ☐ | | |
| Orders / empty | ☐ | | |
| No demo/Peak/Alpine | ☐ | | |

When **all** rows are Pass, update this document’s Final result to **PASSED** and flip release recommendation to:

```text
✅ READY FOR SHOPIFY RESUBMISSION
```

---

## 4. Screenshots

**None attached** — no interactive Admin session in this run.

Place future screenshots under:

`docs/smoke-evidence/YYYY-MM-DD/`

---

## 5. Related docs

- [`PRODUCTION_VERIFICATION_DEMO_API.md`](./PRODUCTION_VERIFICATION_DEMO_API.md) — demo API 404 verified  
- [`SHOPIFY_RELEASE_CHECKLIST.md`](./SHOPIFY_RELEASE_CHECKLIST.md) — gate G7 still open  
