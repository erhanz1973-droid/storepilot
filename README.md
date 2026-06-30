# StorePilot AI

Shopify AI Store Manager that **analyzes** store data and generates actionable recommendations. It does **not** automatically change the merchant's store.

## Features

- **Dashboard** — Store Health Score, Today's AI Brief, Tasks, Revenue Opportunities, Critical Alerts
- **Recommendation Engine** — Modular analyzers with auto-discovery registry
- **Approval Center** — Approve, Ignore, Snooze, Complete
- **Ask AI** — Conversational business advisor grounded in store data
- **Connector plugins** — Shopify, Meta Ads (+ placeholders for Google Ads, Klaviyo, TikTok, ERP)
- **Supabase persistence** — Production tables with in-memory fallback for local dev

## Quick start

```bash
cd storepilot-ai
npm install
cp .env.example .env.local   # optional — runs on demo data without keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation (Phase 6A)

Before launch, run the automated validation suite:

```bash
npm run validate              # profit, ROAS, attribution, AI evidence tests
npm run dev                   # then /validation?run=1 for full report + go/no-go
```

See [VALIDATION.md](./VALIDATION.md) and [PILOT_PROGRAM.md](./PILOT_PROGRAM.md).

Apply migration `supabase/migrations/20260616170000_validation_feedback.sql` for recommendation feedback storage.

## Supabase setup

1. Create a Supabase project
2. Run `supabase/migrations/20260616120000_initial_schema.sql` in the SQL editor
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

Without Supabase credentials, the app uses in-memory persistence (resets on server restart).

## Shopify App setup (OAuth)

1. Create a Shopify Partner app at [partners.shopify.com](https://partners.shopify.com)
2. Set **App URL** and **Allowed redirection URL(s)** to:
   - App URL: `http://localhost:3000` (or your production URL)
   - Redirect: `http://localhost:3000/api/shopify/callback`
3. Configure `.env.local`:

```env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=http://localhost:3000
SHOPIFY_TOKEN_ENCRYPTION_KEY=your-32-char-random-secret
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

4. Run migrations including `supabase/migrations/20260616130000_shopify_oauth.sql`
5. Visit **Connected Store** → enter shop domain → complete OAuth install

Access tokens are encrypted at rest (AES-256-GCM). Multi-store is supported via `storepilot_active_store_id` cookie set on install.

### Webhooks

On install, StorePilot registers `app/uninstalled`. Point webhooks to:

`POST /api/shopify/webhooks`

## API routes (preserved + new)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard` | GET | Dashboard snapshot |
| `/api/recommendations` | GET | All recommendations with approval status |
| `/api/approvals` | GET | All approval records |
| `/api/approvals` | POST | `{ recommendationId, status, note?, snoozeDays? }` |
| `/api/history` | GET | `?status=&priority=&category=` |
| `/api/shopify/auth` | GET | `?shop=store.myshopify.com` — start OAuth |
| `/api/shopify/callback` | GET | OAuth callback (Shopify redirect) |
| `/api/shopify/webhooks` | POST | Install/uninstall webhooks |
| `/api/ask-ai/chat` | POST | `{ message, sessionId? }` — AI advisor |
| `/api/ask-ai/explain` | POST | `{ recommendationId }` — explain recommendation |

## Architecture

```
src/
  app/                      # Pages + API routes
  actions/                  # Server Actions (approvals)
  components/               # UI (preserved visual identity)
  lib/
    connectors/
      plugins/              # connect(), sync(), healthCheck(), disconnect()
      registry.ts
    recommendations/        # Modular analyzers (auto-discovered)
    db/                     # Supabase + memory repository
    services/               # Dashboard, AI brief
    supabase/               # Client config
supabase/migrations/        # Production schema
```

## Database tables

- `stores`, `users`
- `recommendations` (UUID, status, timestamps)
- `approvals`, `recommendation_history`
- `connectors`, `daily_snapshots`

## UX principles

- "Campaign Needs Review" — not "Stop Campaign"
- "Price Increase Opportunity" — not "Increase Price"
- Every recommendation includes why, expected impact, confidence, and supporting metrics
