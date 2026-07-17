# Railway Scheduler — StorePilot Cron Jobs

StorePilot no longer relies on Vercel Cron (`vercel.json` is retained only as a
schedule reference). Production runs on **Railway**. Scheduled sync must call
the existing HTTP cron endpoints with `CRON_SECRET`.

## Endpoints (unchanged)

| Path | Schedule (recommended) | Purpose |
|------|------------------------|---------|
| `POST /api/cron/ga4-sync` | every 4 hours | Sync all active GA4 properties |
| `POST /api/cron/connectors-sync` | every 4 hours | Sync Meta Ads + Google Ads |
| `POST /api/cron/learning-measure` | daily 06:00 UTC | Learning / outcome measurement |

Auth (all endpoints):

```http
Authorization: Bearer $CRON_SECRET
```

In production, requests without a valid secret return `401`.

## Option A — Railway Cron Job (recommended)

1. In the Railway project, create a **Cron Job** service (or a second service
   with a cron schedule).
2. Use the same repo / Dockerfile / Node runtime as the web app.
3. Set start command:

```bash
npm run cron:railway
```

4. Set env vars on that service:

| Variable | Value |
|----------|--------|
| `STOREPILOT_APP_URL` | `https://storepilot-production-d591.up.railway.app` |
| `CRON_SECRET` | **same** value as the web service |
| `CRON_JOBS` | `ga4-sync,connectors-sync,learning-measure` (optional) |

5. Schedules (configure in Railway UI — two jobs is fine):

- **Ads + GA4 sync:** `0 */4 * * *` → `CRON_JOBS=ga4-sync,connectors-sync`
- **Learning measure:** `0 6 * * *` → `CRON_JOBS=learning-measure`

The runner script is `scripts/railway-cron.mjs`. It POSTs each job URL and
exits non-zero if any job fails.

## Option B — External scheduler

Any cron (cron-job.org, GitHub Actions, etc.):

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://storepilot-production-d591.up.railway.app/api/cron/ga4-sync"

curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://storepilot-production-d591.up.railway.app/api/cron/connectors-sync"

curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://storepilot-production-d591.up.railway.app/api/cron/learning-measure"
```

## Verification

```bash
# Expect 401 without secret
curl -s -o /dev/null -w "%{http_code}\n" \
  https://storepilot-production-d591.up.railway.app/api/cron/ga4-sync

# Expect 200 with secret
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://storepilot-production-d591.up.railway.app/api/cron/ga4-sync
```

Check Railway logs for `[railway_cron]` JSON lines after the cron job fires.
