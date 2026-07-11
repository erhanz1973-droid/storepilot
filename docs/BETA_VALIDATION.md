# StorePilot Private Beta — Validation Phase

**Purpose:** Verify StorePilot using **real Shopify stores** before inviting beta merchants.

**Gate:** Private Beta begins only when **every scenario below passes** with documented evidence.

**Quality metric:** Merchant trust — not feature count.

---

## How to run validation

1. Use a **dedicated validation Shopify store** (or stores) — not demo scenarios or simulation lab stores.
2. Work through scenarios **in order** (1 → 8). Later scenarios build on earlier connection states.
3. For each scenario, complete the **PASS / FAIL checklist** and capture **screenshots** into `docs/beta-validation/screenshots/`.
4. Record results in the **Validation log** at the bottom of this document.
5. File issues for any FAIL before inviting merchants.

**Setup helpers**

| Resource | Path |
|----------|------|
| Onboarding wizard | `/onboarding` |
| Connections | `/connections` |
| Executive Dashboard | `/analytics/executive` |
| Marketing / Advertising | `/analytics/marketing`, `/advertising` |
| Integration Health | `/integration-health` |
| Automated scenario tests | `npm test -- src/lib/trust/__tests__/beta-validation-scenarios.test.ts` |

**Screenshot naming:** `scenario-{N}-{surface}-{YYYYMMDD}.png`  
Example: `scenario-2-executive-20260711.png`

Store screenshots in: [`docs/beta-validation/screenshots/`](beta-validation/screenshots/)

---

## Scenario 1 — Fresh Shopify store

**Setup:** New StorePilot account. Shopify store connected but **no orders**, **no ad platforms**, minimal catalog.

### Expected behavior

- No demo data on live store context
- Empty states with clear next steps
- Onboarding wizard guides setup (`/onboarding`)
- Missing integrations explained — not placeholder AI

### PASS / FAIL checklist

| # | Check | PASS | FAIL | Notes |
|---|--------|:----:|:----:|-------|
| 1.1 | Demo Mode banner **hidden** on live store | ☐ | ☐ | |
| 1.2 | `/onboarding` shows Shopify as current step | ☐ | ☐ | |
| 1.3 | Executive Dashboard shows connect guidance (not fabricated KPIs) | ☐ | ☐ | |
| 1.4 | `/advertising` shows connect CTA, not campaign workspace | ☐ | ☐ | |
| 1.5 | No simulated campaigns in any view | ☐ | ☐ | |
| 1.6 | No synthetic AI recommendations | ☐ | ☐ | |

### Screenshots

| Surface | File | Captured |
|---------|------|:--------:|
| Onboarding | `scenario-1-onboarding-*.png` | ☐ |
| Executive | `scenario-1-executive-*.png` | ☐ |
| Advertising | `scenario-1-advertising-*.png` | ☐ |
| Connections | `scenario-1-connections-*.png` | ☐ |

---

## Scenario 2 — Shopify only

**Setup:** Live Shopify with orders/products synced. **Meta and Google NOT connected.**

### Expected behavior

Executive Dashboard explains:

> *"I can analyze your store performance. Connect advertising platforms to unlock marketing intelligence."*

- **No advertising recommendations** generated
- Budget allocation unavailable (not fake cross-channel split)
- Channel comparison hidden

### PASS / FAIL checklist

| # | Check | PASS | FAIL | Notes |
|---|--------|:----:|:----:|-------|
| 2.1 | Executive integration banner shows Shopify-only message | ☐ | ☐ | |
| 2.2 | Ad Spend KPI shows "Connect Meta or Google Ads" | ☐ | ☐ | |
| 2.3 | No campaign priority queue / ad-specific executive recs | ☐ | ☐ | |
| 2.4 | `/analytics/marketing` — budget allocation says connect ads | ☐ | ☐ | |
| 2.5 | Channel comparison card **not rendered** | ☐ | ☐ | |
| 2.6 | `/advertising` empty state (no campaigns) | ☐ | ☐ | |

### Screenshots

| Surface | File | Captured |
|---------|------|:--------:|
| Executive banner | `scenario-2-executive-*.png` | ☐ |
| Marketing budget | `scenario-2-marketing-*.png` | ☐ |
| Advertising empty | `scenario-2-advertising-*.png` | ☐ |

---

## Scenario 3 — Shopify + Meta

**Setup:** Meta Ads connected with active campaigns. **Google NOT connected.**

### Expected behavior

- Advertising recommendations based **only on Meta**
- Google shown as **"Not Connected"**
- **No synthetic channel comparison**
- Budget allocation in **single-channel mode** (Meta only)

### PASS / FAIL checklist

| # | Check | PASS | FAIL | Notes |
|---|--------|:----:|:----:|-------|
| 3.1 | Meta campaigns visible in Advertising workspace | ☐ | ☐ | |
| 3.2 | Google platform card shows "Not Connected" | ☐ | ☐ | |
| 3.3 | Channel comparison **absent** on Marketing page | ☐ | ☐ | |
| 3.4 | Budget allocation cites Meta-only (no Google %) | ☐ | ☐ | |
| 3.5 | No Google campaign data influencing recommendations | ☐ | ☐ | |
| 3.6 | Integration banner mentions single-channel if shown | ☐ | ☐ | |

### Screenshots

| Surface | File | Captured |
|---------|------|:--------:|
| Advertising platforms | `scenario-3-advertising-*.png` | ☐ |
| Marketing (no comparison) | `scenario-3-marketing-*.png` | ☐ |
| Connections Meta | `scenario-3-connections-*.png` | ☐ |

---

## Scenario 4 — Shopify + Google

**Setup:** Google Ads connected. **Meta NOT connected.** (Disconnect Meta if needed.)

### Expected behavior

- Recommendations reference **Google only**
- Meta does **not** influence conclusions
- Same single-channel gating as Scenario 3, mirrored

### PASS / FAIL checklist

| # | Check | PASS | FAIL | Notes |
|---|--------|:----:|:----:|-------|
| 4.1 | Google campaigns visible | ☐ | ☐ | |
| 4.2 | Meta shows "Not Connected" | ☐ | ☐ | |
| 4.3 | No channel comparison | ☐ | ☐ | |
| 4.4 | Budget allocation Google-only mode | ☐ | ☐ | |
| 4.5 | No Meta data in recommendation text | ☐ | ☐ | |

### Screenshots

| Surface | File | Captured |
|---------|------|:--------:|
| Advertising | `scenario-4-advertising-*.png` | ☐ |
| Marketing | `scenario-4-marketing-*.png` | ☐ |

---

## Scenario 5 — Shopify + Meta + Google (full stack)

**Setup:** Both ad platforms connected with campaign data and product costs where possible.

### Expected behavior

- Cross-channel recommendations
- Budget allocation (cross-channel mode)
- Channel comparison with **profit-validated** AI text
- Executive AI + Advertising AI internally consistent
- No contradiction (e.g., shift budget to unprofitable channel without trade-off explanation)

### PASS / FAIL checklist

| # | Check | PASS | FAIL | Notes |
|---|--------|:----:|:----:|-------|
| 5.1 | Channel comparison visible with Meta + Google metrics | ☐ | ☐ | |
| 5.2 | AI recommendation consistent with profit column | ☐ | ☐ | |
| 5.3 | If Google ROAS high but profit negative, text warns before budget shift | ☐ | ☐ | |
| 5.4 | Budget allocation shows cross-channel mode + improvement estimate | ☐ | ☐ | |
| 5.5 | Executive priority action aligns with top marketing priority | ☐ | ☐ | |
| 5.6 | Advertising optimization packages don't say "scale" on losing campaigns | ☐ | ☐ | |
| 5.7 | Automated test suite green | ☐ | ☐ | `npm test -- src/lib/trust/` |

### Screenshots

| Surface | File | Captured |
|---------|------|:--------:|
| Channel comparison | `scenario-5-comparison-*.png` | ☐ |
| Budget allocation | `scenario-5-budget-*.png` | ☐ |
| Executive priority | `scenario-5-executive-*.png` | ☐ |
| Advertising AI | `scenario-5-advertising-*.png` | ☐ |

---

## Scenario 6 — Integration failure

**Setup:** Start from Scenario 5. **Disconnect Meta.** **Expire or revoke Google token** (or simulate via Connections).

### Expected behavior

- Application **explains the issue** (token expired / sync failed)
- **No crashes**
- **No fake recommendations**
- **No synthetic data** on live store
- Failed platform excluded from recommendations

### PASS / FAIL checklist

| # | Check | PASS | FAIL | Notes |
|---|--------|:----:|:----:|-------|
| 6.1 | Connections shows error state for failed integrations | ☐ | ☐ | |
| 6.2 | Integration Health explains failure | ☐ | ☐ | |
| 6.3 | Executive / Advertising banners mention unavailable integrations | ☐ | ☐ | |
| 6.4 | No page crash (error boundary recovery if server error) | ☐ | ☐ | |
| 6.5 | Channel comparison hidden when either platform down | ☐ | ☐ | |
| 6.6 | No demo/synthetic campaigns appear | ☐ | ☐ | |
| 6.7 | Stale recommendations purged or marked unavailable within TTL | ☐ | ☐ | |

### Screenshots

| Surface | File | Captured |
|---------|------|:--------:|
| Connections error | `scenario-6-connections-*.png` | ☐ |
| Executive banner | `scenario-6-executive-*.png` | ☐ |
| Integration health | `scenario-6-health-*.png` | ☐ |

---

## Scenario 7 — Low data store

**Setup:** Store with **very few orders** (<15 in 30d) and **minimal ad spend** (<$50/week).

### Expected behavior

- AI communicates **low confidence**
- Avoids strong conclusions ("pause immediately", large budget shifts)
- Suggests waiting for additional data where appropriate

### PASS / FAIL checklist

| # | Check | PASS | FAIL | Notes |
|---|--------|:----:|:----:|-------|
| 7.1 | Executive or integration banner mentions limited data | ☐ | ☐ | |
| 7.2 | Campaign recs use "continue learning" / monitor language | ☐ | ☐ | |
| 7.3 | No large dollar recovery estimates without evidence | ☐ | ☐ | |
| 7.4 | Decision confidence shows Low/Moderate where appropriate | ☐ | ☐ | |
| 7.5 | Profit confidence reflects missing/estimated inputs | ☐ | ☐ | |

### Screenshots

| Surface | File | Captured |
|---------|------|:--------:|
| Executive low confidence | `scenario-7-executive-*.png` | ☐ |
| Campaign learning phase | `scenario-7-marketing-*.png` | ☐ |
| Decisions confidence | `scenario-7-decisions-*.png` | ☐ |

---

## Scenario 8 — High volume merchant

**Setup:** Store with **large order history** (1000+ orders/30d) and **many campaigns** (20+).

### Expected behavior

- Page loads remain acceptable (Executive <15s cold, Advertising <20s cold)
- AI recommendations remain **coherent** (no timeout fallbacks to demo)
- No UI jank or browser freeze on campaign tables

### PASS / FAIL checklist

| # | Check | PASS | FAIL | Notes |
|---|--------|:----:|:----:|-------|
| 8.1 | Executive Dashboard loads without error | ☐ | ☐ | Record load time: ___s |
| 8.2 | Advertising workspace loads without error | ☐ | ☐ | Record load time: ___s |
| 8.3 | Recommendations list is coherent (no duplicate/contradictory rows) | ☐ | ☐ | |
| 8.4 | No demo data fallback in production | ☐ | ☐ | |
| 8.5 | `npm run validate` performance budgets pass | ☐ | ☐ | Optional CI gate |

### Screenshots

| Surface | File | Captured |
|---------|------|:--------:|
| Executive loaded | `scenario-8-executive-*.png` | ☐ |
| Advertising loaded | `scenario-8-advertising-*.png` | ☐ |
| Network/timing notes | `scenario-8-perf-notes-*.txt` | ☐ |

---

## Beta Readiness Gate

Private Beta **START** criteria — all must be true:

| Gate | Status |
|------|:------:|
| Scenarios 1–8 all PASS | ☐ |
| All screenshot slots filled or N/A documented | ☐ |
| No open P0 bugs from validation | ☐ |
| `npm test -- src/lib/trust/` green | ☐ |
| Trust checklist (`docs/WEEK_1_BETA_CHECKLIST.md`) P2–P0 complete | ☐ |
| Validation log signed off | ☐ |

**Signed off by:** _______________ **Date:** _______________

---

## Validation log

| Scenario | Tester | Date | Result | Blockers |
|----------|--------|------|--------|----------|
| 1 Fresh Shopify | | | PASS / FAIL | |
| 2 Shopify only | | | PASS / FAIL | |
| 3 Shopify + Meta | | | PASS / FAIL | |
| 4 Shopify + Google | | | PASS / FAIL | |
| 5 Full stack | | | PASS / FAIL | |
| 6 Integration failure | | | PASS / FAIL | |
| 7 Low data | | | PASS / FAIL | |
| 8 High volume | | | PASS / FAIL | |

---

## Code references (automated guards)

| Guard | File |
|-------|------|
| Integration readiness phases | `src/lib/trust/integration-readiness.ts` |
| Demo/live data mode | `src/lib/trust/data-mode.ts` |
| Profit validation on channel shifts | `src/lib/trust/recommendation-validation.ts` |
| Channel comparison null gate | `src/lib/analytics/marketing-executive-layer.ts` |
| Budget allocation modes | `src/lib/analytics/marketing-manager-v2.ts` |
| Scenario tests | `src/lib/trust/__tests__/beta-validation-scenarios.test.ts` |

---

## Related docs

- [Week 1 Beta Checklist](WEEK_1_BETA_CHECKLIST.md)
- [Calculations reference](CALCULATIONS.md)
- [Source traceability](SOURCE_TRACEABILITY.md)
