import {
  isShopifyLoginPath,
  runEmbeddedAuth,
  runEmbeddedLogin,
} from "@/lib/shopify/embedded-auth.server";

export const dynamic = "force-dynamic";

function isOAuthCodeCallback(request: Request): boolean {
  const url = new URL(request.url);
  return url.pathname.endsWith("/auth/callback") && url.searchParams.has("code");
}

async function handleAuth(request: Request): Promise<Response> {
  if (isShopifyLoginPath(request)) {
    return runEmbeddedLogin(request);
  }

  if (isOAuthCodeCallback(request)) {
    console.log("[embedded-auth] /auth/callback OAuth code detected — delegating to authenticate.admin");
  }

  return runEmbeddedAuth(request);
}

export async function GET(request: Request) {
  return handleAuth(request);
}

export async function POST(request: Request) {
  return handleAuth(request);
}
