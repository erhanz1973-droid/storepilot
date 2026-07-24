# Alpine Outfitters — App Store Demo Store

**Fictional data only.** Used for Shopify App Store review videos, website demos, and product walkthroughs.

Never written to production merchant stores. Gated by `STOREPILOT_ALLOW_DEMO`.

## Store profile

| Field | Value |
|-------|-------|
| Name | Alpine Outfitters |
| Industry | Premium outdoor apparel and accessories |
| Revenue (30d) | $82,450 |
| Profit (30d) | $16,870 |
| Orders | 1,248 |
| AOV | $66.10 |
| Conversion rate | 3.4% |
| Blended ROAS | 4.38 |
| Store health | 94 |
| AI confidence | 98% |
| Meta Ads | $9,850 spend → $34,900 rev (3.54 ROAS) |
| Google Ads | $5,420 spend → $23,600 rev (4.35 ROAS) |
| GA4 | 54,800 sessions · 41,900 users · 32% returning |

## Architecture

- **Demo Data Provider:** `src/lib/demo/provider.ts`
- **Store modules:** this folder
- **Default scenario:** `healthy_growth` → Alpine Outfitters
- **Mode switch:** `STOREPILOT_ALLOW_DEMO` (`true` / `false` / unset→OFF (opt-in only))

## Isolation

- Store ID: `00000000-0000-4000-8000-000000000001`
- Domain: `alpine-outfitters.demo.storepilot.ai`
- Snapshot `source: "demo"` — production connectors never mutate this data
- All figures are deterministic (no `Math.random()`)
