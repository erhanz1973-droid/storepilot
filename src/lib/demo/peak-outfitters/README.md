# Peak Outfitters — Demo Store

**Fictional data only.** Used when no live Shopify store is connected.

## Store profile

| Field | Value |
|-------|-------|
| Name | Peak Outfitters |
| Industry | Outdoor & Hiking Equipment |
| Country | United States |
| Currency | USD |
| Store age | 18 months |
| Revenue (30d) | $184,250 |
| Net profit (30d) | ~$42,870 |
| Orders | 1,487 |
| AOV | $123.90 |
| Sessions | 58,420 |
| Conversion rate | 2.54% |
| Store health | 82 / 100 — Healthy |

## Data modules

| File | Contents |
|------|----------|
| `constants.ts` | Store KPIs, collections, inventory summary |
| `products.ts` | 30 products (8 bestsellers, 12 average, 6 slow, 4 dead) |
| `meta-campaigns.ts` | 8 Meta campaigns |
| `google-campaigns.ts` | 6 Google campaigns |
| `ga4.ts` | Sessions, sources, devices, landing pages |
| `attribution.ts` | Multi-touch customer journeys |
| `daily-metrics.ts` | 90-day charts with seasonality |
| `index.ts` | `getPeakOutfittersSnapshot()` |

## Isolation

- Store ID: `00000000-0000-4000-8000-000000000001` (unchanged)
- `allowDemoData()` must be true (development default)
- Production: demo disabled unless `STOREPILOT_ALLOW_DEMO=true`
- **Demo Data** banner shown in app layout when not on live Shopify

## AI recommendations

Analyzers read live snapshot data — recommendations for **Prospecting Broad**, **Summer Hiking**, **Camping Lantern XL**, and bundles are generated from campaign/product performance automatically.
