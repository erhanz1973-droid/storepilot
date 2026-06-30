import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

function readBuildId(): string | null {
  try {
    return readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return null;
  }
}

/** Temporary deploy verification — remove after confirming Railway routing. */
export async function GET() {
  return NextResponse.json({
    buildId: readBuildId(),
    gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT ?? null,
    cwd: process.cwd(),
    RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME ?? null,
    RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME ?? null,
    RAILWAY_PROJECT_NAME: process.env.RAILWAY_PROJECT_NAME ?? null,
    timestamp: new Date().toISOString(),
  });
}
