import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";

import { DEFAULT_SHOPIFY_SCOPES, getShopifyConfig, isShopifyOAuthConfigured } from "@/lib/shopify/oauth";
import { runAfterEmbeddedAuth } from "@/lib/shopify/after-embedded-auth.server";
import { SupabaseSessionStorage } from "@/lib/shopify/supabase-session-storage";

function resolveAppUrl(): string {
  const config = getShopifyConfig();
  if (!config?.appUrl) {
    throw new Error("SHOPIFY_APP_URL (or NEXT_PUBLIC_APP_URL) is required for embedded auth");
  }
  return config.appUrl;
}

function resolveScopes(): string[] {
  const config = getShopifyConfig();
  const raw = config?.scopes ?? DEFAULT_SHOPIFY_SCOPES;
  return raw
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

const sessionStorage = new SupabaseSessionStorage();

type StorePilotShopifyApp = ReturnType<typeof shopifyApp>;

let shopifySingleton: StorePilotShopifyApp | null = null;

export function getShopifyApp(): StorePilotShopifyApp {
  if (shopifySingleton) return shopifySingleton;

  if (!isShopifyOAuthConfigured()) {
    throw new Error("Shopify OAuth is not configured — set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL");
  }

  shopifySingleton = shopifyApp({
    apiKey: process.env.SHOPIFY_API_KEY ?? "",
    apiSecretKey: process.env.SHOPIFY_API_SECRET ?? "",
    apiVersion: ApiVersion.October25,
    scopes: resolveScopes(),
    appUrl: resolveAppUrl(),
    authPathPrefix: "/auth",
    sessionStorage,
    distribution: AppDistribution.AppStore,
    future: {
      expiringOfflineAccessTokens: true,
    },
    hooks: {
      afterAuth: async ({ session }) => {
        await runAfterEmbeddedAuth(session);
      },
    },
  });

  return shopifySingleton;
}

export { sessionStorage };
