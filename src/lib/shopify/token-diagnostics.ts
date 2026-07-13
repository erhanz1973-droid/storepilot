import { getShopifyConfig } from "@/lib/shopify/oauth";

export type ShopifyTokenDiagnostics = {
  shopDomain: string;
  currentApiKeyPrefix: string | null;
  storedClientIdPrefix: string | null;
  tokenDecryptSucceeded: boolean;
  /** true = same app, false = mismatch, null = legacy row without client_id */
  appMatch: boolean | null;
  reinstallRequired: boolean;
  reason?: string;
};

export function shopifyApiKeyPrefix(apiKey?: string | null): string | null {
  const key = apiKey?.trim();
  if (!key) return null;
  return key.slice(0, 6);
}

export function currentShopifyApiKeyPrefix(): string | null {
  return shopifyApiKeyPrefix(getShopifyConfig()?.apiKey ?? process.env.SHOPIFY_API_KEY);
}

export function detectAppMismatch(storedClientId: string | null | undefined): {
  appMatch: boolean | null;
  mismatch: boolean;
  storedClientIdPrefix: string | null;
  currentClientIdPrefix: string | null;
} {
  const currentPrefix = currentShopifyApiKeyPrefix();
  const stored = storedClientId?.trim() || null;
  const storedPrefix = shopifyApiKeyPrefix(stored);

  if (!stored) {
    return {
      appMatch: null,
      mismatch: false,
      storedClientIdPrefix: null,
      currentClientIdPrefix: currentPrefix,
    };
  }

  if (!currentPrefix) {
    return {
      appMatch: null,
      mismatch: false,
      storedClientIdPrefix: storedPrefix,
      currentClientIdPrefix: null,
    };
  }

  const match = stored === (getShopifyConfig()?.apiKey ?? process.env.SHOPIFY_API_KEY)?.trim();
  return {
    appMatch: match,
    mismatch: !match,
    storedClientIdPrefix: storedPrefix,
    currentClientIdPrefix: currentPrefix,
  };
}

export function logShopifyTokenDiagnostics(diagnostics: ShopifyTokenDiagnostics): void {
  console.log(
    "[shopify-auth]",
    JSON.stringify({
      shopDomain: diagnostics.shopDomain,
      currentApiKeyPrefix: diagnostics.currentApiKeyPrefix,
      storedClientIdPrefix: diagnostics.storedClientIdPrefix,
      tokenDecryptSucceeded: diagnostics.tokenDecryptSucceeded,
      appMatch: diagnostics.appMatch,
      reinstallRequired: diagnostics.reinstallRequired,
      reason: diagnostics.reason,
    }),
  );
}
