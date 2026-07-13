import { TokenDecryptionError } from "@/lib/crypto/decrypt-errors";
import {
  ShopifyAccessTokenInvalidError,
  ShopifyAppMismatchError,
} from "@/lib/shopify/auth-errors";
import { decryptToken } from "@/lib/shopify/crypto";
import { getShopifyConfig } from "@/lib/shopify/oauth";
import {
  detectAppMismatch,
  logShopifyTokenDiagnostics,
  type ShopifyTokenDiagnostics,
} from "@/lib/shopify/token-diagnostics";

export type ResolvedShopifyAccessToken = {
  accessToken: string;
  diagnostics: ShopifyTokenDiagnostics;
};

export function resolveCurrentShopifyClientId(): string | null {
  return getShopifyConfig()?.apiKey?.trim() ?? process.env.SHOPIFY_API_KEY?.trim() ?? null;
}

export function assertInstallationAppMatch(
  shopDomain: string,
  storedClientId: string | null | undefined,
): ShopifyTokenDiagnostics {
  const mismatch = detectAppMismatch(storedClientId);
  const diagnostics: ShopifyTokenDiagnostics = {
    shopDomain,
    currentApiKeyPrefix: mismatch.currentClientIdPrefix,
    storedClientIdPrefix: mismatch.storedClientIdPrefix,
    tokenDecryptSucceeded: true,
    appMatch: mismatch.appMatch,
    reinstallRequired: mismatch.mismatch,
    reason: mismatch.mismatch
      ? "stored installation belongs to a different Shopify Partner app"
      : undefined,
  };

  logShopifyTokenDiagnostics(diagnostics);

  if (mismatch.mismatch) {
    throw new ShopifyAppMismatchError(
      shopDomain,
      mismatch.storedClientIdPrefix,
      mismatch.currentClientIdPrefix ?? "??????",
    );
  }

  return diagnostics;
}

export function resolveShopifyAccessToken(input: {
  shopDomain: string;
  accessTokenEncrypted: string;
  storedClientId?: string | null;
}): ResolvedShopifyAccessToken {
  let accessToken: string;
  let tokenDecryptSucceeded = false;

  try {
    accessToken = decryptToken(input.accessTokenEncrypted);
    tokenDecryptSucceeded = true;
  } catch (error) {
    const mismatch = detectAppMismatch(input.storedClientId);
    logShopifyTokenDiagnostics({
      shopDomain: input.shopDomain,
      currentApiKeyPrefix: mismatch.currentClientIdPrefix,
      storedClientIdPrefix: mismatch.storedClientIdPrefix,
      tokenDecryptSucceeded: false,
      appMatch: mismatch.appMatch,
      reinstallRequired: error instanceof TokenDecryptionError,
      reason:
        error instanceof TokenDecryptionError
          ? "token decryption failed"
          : "token load failed",
    });
    throw error;
  }

  const diagnostics = assertInstallationAppMatch(input.shopDomain, input.storedClientId);
  return {
    accessToken,
    diagnostics: { ...diagnostics, tokenDecryptSucceeded },
  };
}

export function markAccessTokenInvalidFromHttp(
  shopDomain: string,
  httpStatus: number,
  detail?: string,
): ShopifyAccessTokenInvalidError {
  const mismatch = detectAppMismatch(null);
  logShopifyTokenDiagnostics({
    shopDomain,
    currentApiKeyPrefix: mismatch.currentClientIdPrefix,
    storedClientIdPrefix: null,
    tokenDecryptSucceeded: true,
    appMatch: null,
    reinstallRequired: true,
    reason: `Shopify API HTTP ${httpStatus}`,
  });
  return new ShopifyAccessTokenInvalidError(shopDomain, httpStatus, detail);
}
