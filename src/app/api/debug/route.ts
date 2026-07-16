import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { hasServiceSecret } from "@/lib/api/route-auth";
import { isShopifyOAuthConfigured } from "@/lib/shopify/oauth";
import { currentShopifyApiKeyPrefix } from "@/lib/shopify/token-diagnostics";

function readBuildId(): string | null {
  try {
    return readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return null;
  }
}

function readAppPathsManifest(): Record<string, string> | null {
  const manifestPath = join(process.cwd(), ".next/server/app-paths-manifest.json");
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, string>;
  } catch {
    return null;
  }
}

/** Deploy verification — requires a trusted service secret in all environments. */
export async function GET(request: Request) {
  if (!hasServiceSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const manifestPath = join(process.cwd(), ".next/server/app-paths-manifest.json");
  const manifest = readAppPathsManifest();
  const shopifyKeys = manifest
    ? Object.keys(manifest).filter((key) => key.includes("shopify"))
    : [];

  return NextResponse.json({
    buildId: readBuildId(),
    gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT ?? null,
    cwd: process.cwd(),
    nodeVersion: process.version,
    RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME ?? null,
    RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME ?? null,
    RAILWAY_PROJECT_NAME: process.env.RAILWAY_PROJECT_NAME ?? null,
    manifestPath,
    shopifyAuthInManifest: manifest ? "/api/shopify/auth/route" in manifest : false,
    shopifyAuthFileExists: existsSync(
      join(process.cwd(), ".next/server/app/api/shopify/auth/route.js")
    ),
    shopifyCallbackFileExists: existsSync(
      join(process.cwd(), ".next/server/app/api/shopify/callback/route.js")
    ),
    shopifyKeys,
    embeddedAuthRoute: "/auth/[...slug]",
    legacyOAuthRoutes: {
      auth: "/api/shopify/auth",
      callback: "/api/shopify/callback",
    },
    shopifyOAuthConfigured: isShopifyOAuthConfigured(),
    shopifyApiKeyPrefix: currentShopifyApiKeyPrefix(),
    timestamp: new Date().toISOString(),
  });
}
