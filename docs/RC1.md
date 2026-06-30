# Release Candidate 1 (RC1)

**Policy from RC1 forward:** No new features. Only bug fixes, validation, optimization, and App Store compliance.

## RC1 gate criteria

All must be true before tagging `v0.1.0-rc1`:

### Validation (Phases 1–4)
- [ ] `npm run validate` passes (profit, ROAS, attribution, metrics, app_store suites)
- [ ] [METRIC_VALIDATION_TABLE.md](./METRIC_VALIDATION_TABLE.md) — all **PASS** or documented **ESTIMATED**
- [ ] [CROSS_VALIDATION.md](./CROSS_VALIDATION.md) — pilot store sign-off complete
- [ ] No **BLOCKED** metrics in App Store listing claims (GA4)

### Data integrity (Phases 5–6)
- [ ] `INTEGRATIONS_DEMO=false` in production
- [ ] No fabricated metrics on production pages
- [ ] Shopify + Meta + Google OAuth and sync verified
- [ ] Token encryption keys set (≥32 chars each)

### Stability & performance (Phases 7–8)
- [ ] Dashboard loads &lt; 3s on pilot data
- [ ] Reports page loads &lt; 5s
- [ ] Empty store, no-ads store, Meta-only, Google-only — no crashes
- [ ] API failure shows friendly error, not blank crash

### App Store (Phase 9)
- [ ] OAuth on production domain
- [ ] `app/uninstalled` webhook
- [ ] Privacy Policy + Terms URLs live
- [ ] Support contact page/email
- [ ] Responsive UI, no console errors on core flows
- [ ] `npm run build` succeeds

## Tagging RC1

```bash
git tag -a v0.1.0-rc1 -m "Release Candidate 1 — validation complete, App Store ready"
git push origin v0.1.0-rc1
```

## After RC1

1. Submit to Shopify App Store review
2. Fix only review feedback and P0 bugs
3. Tag `v0.1.0` after approval

## Current automated status

Run locally:

```bash
npm run validate
```

Check `metrics` suite for RC1 gate (`metric-registry-rc1-gate`).

**Known blockers before RC1:**
- GA4 live connector (sessions, CVR) — **BLOCKED**
- Reports AI outcomes — **PENDING** pilot measurement
- Manual cross-validation — **PENDING** sign-off

## Version

| Milestone | Version | Status |
|-----------|---------|--------|
| MVP feature freeze | — | **Active** |
| RC1 | `v0.1.0-rc1` | Not tagged |
| App Store release | `v0.1.0` | Not submitted |
