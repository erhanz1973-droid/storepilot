# Cross Validation Log (Phase 4)

Record pilot store comparisons here. Re-run after each connector sync.

## Template

| Date | Store | Metric | StorePilot | External source | Variance | Explanation | Status |
|------|-------|--------|------------|-----------------|----------|-------------|--------|
| YYYY-MM-DD | pilot-store.myshopify.com | Revenue 30d | | Shopify Admin | | Same timezone/window? | |
| YYYY-MM-DD | | Orders 30d | | Shopify Admin | | | |
| YYYY-MM-DD | | Net profit 30d | | Spreadsheet | | Includes estimated COGS/fees | |
| YYYY-MM-DD | | Meta spend 7d | | Meta Ads Manager | | Attribution window | |
| YYYY-MM-DD | | Meta ROAS 7d | | Meta Ads Manager | | Platform attribution | |
| YYYY-MM-DD | | Google spend 30d | | Google Ads | | | |
| YYYY-MM-DD | | Blended ROAS | | Manual calc | | Revenue ÷ total spend | |

## Acceptable variance

| Metric | Target | Notes |
|--------|--------|-------|
| Shopify revenue / orders | &lt; 1% | Align date range and currency |
| Meta spend | &lt; 2% | Timezone, account vs campaign level |
| Meta ROAS | May differ | StorePilot blended uses Shopify revenue |
| Google spend | &lt; 2% | |
| Net profit | Manual verify | Estimates for COGS/fees documented |

## Automated cross-checks

```bash
# Full suite
npm run validate

# Meta live pull vs dashboard cache
curl "http://localhost:3000/api/validation/meta?run=1"

# Google smoke test (requires env tokens)
npm run verify:google
```

## Known attribution differences

1. **Blended ROAS** uses total Shopify revenue, not Meta/Google attributed revenue.
2. **Meta purchase value** uses Meta's 7d click/view window.
3. **COGS** may be 45% estimate when unit costs missing — profit will not match Shopify's gross margin report.

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Engineering | | | Automated suites pass |
| Pilot merchant | | | Manual cross-check complete |
