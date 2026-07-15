#!/usr/bin/env node
/**
 * StorePilot production smoke suite (read-only / dry-run).
 *
 *   npm run smoke
 *   npm run smoke:production
 *   railway run npm run smoke:production
 */
import { execSync } from "child_process";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { finalizeSmokeReport, runDirectSmokeChecks } from "./suite-entry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function resolveLocalCommit() {
  try {
    return execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function printAndWriteReport(report) {
  for (const check of report.checks ?? []) {
    console.log(`${check.status} ${check.name}${check.message ? ` — ${check.message}` : ""}`);
  }
  console.log(`\nFinal result:\n${report.final}\n`);

  const commit = report.commitHash && report.commitHash !== "unknown"
    ? report.commitHash
    : resolveLocalCommit();

  const md = [
    `# Production Smoke Report`,
    ``,
    `- **Timestamp:** ${report.startedAt}`,
    `- **Finished:** ${report.finishedAt}`,
    `- **Deployment ID:** ${report.deploymentId ?? "unknown"}`,
    `- **Commit hash:** ${commit}`,
    `- **Base URL:** ${report.baseUrl ?? "unknown"}`,
    `- **Execution time:** ${report.durationMs} ms`,
    `- **Final result:** ${report.final}`,
    ``,
    `## Checks`,
    ``,
    ...(report.checks ?? []).map(
      (c) => `- **${c.status}** ${c.name} (${c.durationMs} ms) — ${c.message}`,
    ),
    ``,
    `## Failures`,
    ``,
    ...(report.failures?.length
      ? report.failures.map((c) => `- ${c.name}: ${c.message}`)
      : ["- None"]),
    ``,
    `## Warnings`,
    ``,
    ...(report.warnings?.length
      ? report.warnings.map((c) => `- ${c.name}: ${c.message}`)
      : ["- None"]),
    ``,
  ].join("\n");

  const outPath = join(root, "production-smoke-report.md");
  writeFileSync(outPath, md, "utf8");
  console.log(`Wrote ${outPath}`);
}

async function main() {
  loadEnvFile(join(root, ".env.local"));
  loadEnvFile(join(root, ".env"));

  const mode = process.env.SMOKE_MODE?.trim() || "local";
  const baseUrl = (
    process.env.SMOKE_BASE_URL ||
    process.env.SHOPIFY_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (mode === "production"
      ? "https://storepilot-production-d591.up.railway.app"
      : "http://localhost:3000")
  ).replace(/\/$/, "");

  const startedAt = new Date().toISOString();
  console.log(`\nStorePilot smoke suite (${mode})`);
  console.log(`Base URL: ${baseUrl}`);
  console.log("Safety: read-only GraphQL/API probes + what-if simulation (no merchant mutations)\n");

  const secret =
    process.env.SMOKE_SECRET?.trim() || process.env.STOREPILOT_INTERNAL_SECRET?.trim();

  let report = null;

  if (secret) {
    try {
      const response = await fetch(`${baseUrl}/api/internal/smoke`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const text = await response.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      if (parsed && Array.isArray(parsed.checks)) {
        report = parsed;
      } else {
        console.warn(
          `[smoke] internal endpoint unavailable (${response.status}); running direct checks`,
        );
      }
    } catch (error) {
      console.warn(
        `[smoke] internal endpoint fetch failed (${
          error instanceof Error ? error.message : String(error)
        }); running direct checks`,
      );
    }
  }

  if (!report) {
    const checks = await runDirectSmokeChecks({ baseUrl });
    report = finalizeSmokeReport({ checks, startedAt, baseUrl });
  }

  if (!report.commitHash || report.commitHash === "unknown") {
    report.commitHash = resolveLocalCommit();
  }

  printAndWriteReport(report);
  process.exit(report.final === "PASS" ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
