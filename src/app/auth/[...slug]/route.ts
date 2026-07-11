import { runEmbeddedAuth } from "@/lib/shopify/embedded-auth.server";

export const dynamic = "force-dynamic";

async function handleAuth(request: Request): Promise<Response> {
  return runEmbeddedAuth(request);
}

export async function GET(request: Request) {
  return handleAuth(request);
}

export async function POST(request: Request) {
  return handleAuth(request);
}
