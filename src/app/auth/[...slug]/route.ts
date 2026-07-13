import {
  isShopifyLoginPath,
  runEmbeddedAuth,
  runEmbeddedLogin,
} from "@/lib/shopify/embedded-auth.server";

export const dynamic = "force-dynamic";

async function handleAuth(request: Request): Promise<Response> {
  // The login route must never require authentication. It starts OAuth via
  // shopify.login(); every other /auth/* path uses authenticate.admin().
  if (isShopifyLoginPath(request)) {
    return runEmbeddedLogin(request);
  }
  return runEmbeddedAuth(request);
}

export async function GET(request: Request) {
  return handleAuth(request);
}

export async function POST(request: Request) {
  return handleAuth(request);
}
