#!/usr/bin/env node
/**
 * Railway-compatible cron runner for StorePilot.
 *
 * Invokes the existing /api/cron/* endpoints with CRON_SECRET.
 * Configure as a Railway Cron Job (or any external scheduler) that runs:
 *
 *   node scripts/railway-cron.mjs
 *
 * Required env:
 *   STOREPILOT_APP_URL  — e.g. https://storepilot-production-d591.up.railway.app
 *   CRON_SECRET         — same value as the web service
 *
 * Optional:
 *   CRON_JOBS           — comma list: ga4-sync,connectors-sync,learning-measure
 *                         default: ga4-sync,connectors-sync,learning-measure
 */

const APP_URL = (process.env.STOREPILOT_APP_URL || process.env.SHOPIFY_APP_URL || "")
  .trim()
  .replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET?.trim() || "";
const JOBS = (
  process.env.CRON_JOBS || "ga4-sync,connectors-sync,learning-measure"
)
  .split(",")
  .map((j) => j.trim())
  .filter(Boolean);

async function runJob(job: string) {
  const url = `${APP_URL}/api/cron/${job}`;
  const started = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const text = await response.text();
  let body = text;
  try {
    body = JSON.stringify(JSON.parse(text));
  } catch {
    // keep raw
  }
  console.log(
    JSON.stringify({
      event: "railway_cron",
      job,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - started,
      body: body.slice(0, 500),
    }),
  );
  if (!response.ok) {
    throw new Error(`Cron job ${job} failed with HTTP ${response.status}`);
  }
}

async function main() {
  if (!APP_URL) {
    console.error("STOREPILOT_APP_URL (or SHOPIFY_APP_URL) is required");
    process.exit(1);
  }
  if (!SECRET) {
    console.error("CRON_SECRET is required");
    process.exit(1);
  }

  const failures = [];
  for (const job of JOBS) {
    try {
      await runJob(job);
    } catch (error) {
      failures.push(job);
      console.error(
        JSON.stringify({
          event: "railway_cron_failed",
          job,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  if (failures.length > 0) {
    process.exit(1);
  }
}

main();
