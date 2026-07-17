# Railway OAuth Environment Variables

Production OAuth for Meta Ads, Google Ads, and GA4 was **not configured** on
Railway (probed 2026-07-17: Meta → 503, Google/GA4 → `*_oauth_not_configured`).

Set the variables below on the **StorePilot web service**, then redeploy.
Also register the redirect URIs in each provider console.

Base URL: `https://storepilot-production-d591.up.railway.app`

---

## Shared (already required for Shopify)

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://storepilot-production-d591.up.railway.app` |
| `SHOPIFY_APP_URL` | Same as above |
| `SHOPIFY_TOKEN_ENCRYPTION_KEY` | ≥32 chars; also used as Meta/Google encryption fallback |
| `CRON_SECRET` | Bearer secret for `/api/cron/*` |
| `STOREPILOT_INTERNAL_SECRET` | Internal/smoke endpoints |
| `SMOKE_SECRET` | Optional; smoke suite auth |

---

## Meta Ads

| Variable | Required | Notes |
|----------|----------|--------|
| `META_APP_ID` | **Yes** | Facebook App ID |
| `META_APP_SECRET` | **Yes** | Facebook App Secret |
| `META_APP_URL` | Recommended | Defaults to `NEXT_PUBLIC_APP_URL` |
| `META_TOKEN_ENCRYPTION_KEY` | Recommended | Falls back to `SHOPIFY_TOKEN_ENCRYPTION_KEY` |
| `META_SCOPES` | Optional | Default: `ads_read,business_management` |

**Redirect URI (Meta App → Facebook Login → Valid OAuth Redirect URIs):**

```
https://storepilot-production-d591.up.railway.app/api/meta/callback
```

**Scopes:** `ads_read`, `business_management`

---

## Google Ads

| Variable | Required | Notes |
|----------|----------|--------|
| `GOOGLE_ADS_CLIENT_ID` | **Yes** | Google Cloud OAuth client |
| `GOOGLE_ADS_CLIENT_SECRET` | **Yes** | |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | **Yes** | Google Ads API developer token |
| `GOOGLE_ADS_APP_URL` | Recommended | Defaults to `NEXT_PUBLIC_APP_URL` |
| `GOOGLE_ADS_TOKEN_ENCRYPTION_KEY` | Recommended | Falls back to Meta/Shopify encryption keys |
| `GOOGLE_ADS_SCOPES` | Optional | Default: `https://www.googleapis.com/auth/adwords openid email profile` |
| `GOOGLE_ADS_API_VERSION` | Optional | Default `v24` |

**Redirect URI (Google Cloud Console → OAuth client → Authorized redirect URIs):**

```
https://storepilot-production-d591.up.railway.app/api/google/callback
```

Must request **offline access** (app already sets `access_type=offline` + `prompt=consent`).

---

## Google Analytics 4

| Variable | Required | Notes |
|----------|----------|--------|
| `GA4_CLIENT_ID` | Yes* | *Falls back to `GOOGLE_ADS_CLIENT_ID` if unset |
| `GA4_CLIENT_SECRET` | Yes* | *Falls back to `GOOGLE_ADS_CLIENT_SECRET` |
| `GA4_APP_URL` | Recommended | Falls back to `GOOGLE_ADS_APP_URL` then `NEXT_PUBLIC_APP_URL` |
| `GA4_SCOPES` | Optional | Default: `https://www.googleapis.com/auth/analytics.readonly openid email profile` |

If Google Ads and GA4 share the same Google Cloud OAuth client, you only need
one client ID/secret — set either the `GA4_*` or `GOOGLE_ADS_*` pair. You still
must register **both** redirect URIs on that client.

**Redirect URI:**

```
https://storepilot-production-d591.up.railway.app/api/ga4/callback
```

**Enable APIs** on the Google Cloud project:

- Google Analytics Data API
- Google Analytics Admin API

---

## Verification after setting vars

```bash
# Meta — expect 307 to facebook.com/.../dialog/oauth (not 503)
curl -s -D - -o /dev/null \
  "https://storepilot-production-d591.up.railway.app/api/meta/auth" | head -20

# Google — expect 307 to accounts.google.com (not ?error=google_oauth_not_configured)
curl -s -D - -o /dev/null \
  "https://storepilot-production-d591.up.railway.app/api/google/auth" | head -20

# GA4 — expect 307 to accounts.google.com (not ?error=ga4_oauth_not_configured)
curl -s -D - -o /dev/null \
  "https://storepilot-production-d591.up.railway.app/api/ga4/auth" | head -20
```

Then complete a real connect flow in Shopify Admin → Connections for each
provider, run Sync, and confirm dashboard/AI receive campaign or session data.
