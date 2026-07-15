/** Installation must be re-authorized — token invalid, revoked, or issued by another app. */
export const SHOPIFY_REINSTALL_REQUIRED_PREFIX = "REINSTALL_REQUIRED:";

export class ShopifyReinstallRequiredError extends Error {
  readonly shopDomain: string;
  readonly reason: string;
  readonly merchantReauthorizationRequired: boolean;

  constructor(shopDomain: string, reason: string, merchantReauthorizationRequired = true) {
    super(`${SHOPIFY_REINSTALL_REQUIRED_PREFIX} ${reason}`);
    this.name = "ShopifyReinstallRequiredError";
    this.shopDomain = shopDomain;
    this.reason = reason;
    this.merchantReauthorizationRequired = merchantReauthorizationRequired;
  }
}

/** Stored installation.client_id does not match runtime SHOPIFY_API_KEY. */
export class ShopifyAppMismatchError extends ShopifyReinstallRequiredError {
  readonly storedClientIdPrefix: string | null;
  readonly currentClientIdPrefix: string;

  constructor(
    shopDomain: string,
    storedClientIdPrefix: string | null,
    currentClientIdPrefix: string,
  ) {
    super(
      shopDomain,
      storedClientIdPrefix
        ? `Access token belongs to Shopify app ${storedClientIdPrefix}… but this deployment uses ${currentClientIdPrefix}…. Reinstall the app from Shopify Admin.`
        : `Access token is not valid for the current Shopify app (${currentClientIdPrefix}…). Reinstall the app from Shopify Admin.`,
    );
    this.name = "ShopifyAppMismatchError";
    this.storedClientIdPrefix = storedClientIdPrefix;
    this.currentClientIdPrefix = currentClientIdPrefix;
  }
}

/** Shopify Admin API rejected the access token (HTTP 401). */
export class ShopifyAccessTokenInvalidError extends ShopifyReinstallRequiredError {
  readonly httpStatus: number;

  constructor(shopDomain: string, httpStatus: number, detail?: string) {
    super(
      shopDomain,
      detail ??
        `Shopify rejected the access token (HTTP ${httpStatus}). Reinstall the app from Shopify Admin.`,
    );
    this.name = "ShopifyAccessTokenInvalidError";
    this.httpStatus = httpStatus;
  }
}

/**
 * Offline refresh cannot recover (missing / expired / invalid_grant refresh token).
 * Callers must return immediately — do not retry GraphQL.
 */
export class ShopifyMerchantReauthorizationRequiredError extends ShopifyReinstallRequiredError {
  readonly failureReason:
    | "missing_refresh_token"
    | "invalid_grant"
    | "expired_refresh_token"
    | "refresh_http_error"
    | "incomplete_token_pair"
    | "oauth_not_configured";

  constructor(
    shopDomain: string,
    failureReason: ShopifyMerchantReauthorizationRequiredError["failureReason"],
    detail: string,
  ) {
    super(shopDomain, detail, true);
    this.name = "ShopifyMerchantReauthorizationRequiredError";
    this.failureReason = failureReason;
  }
}

export function isShopifyReinstallRequiredError(
  error: unknown,
): error is ShopifyReinstallRequiredError {
  return error instanceof ShopifyReinstallRequiredError;
}

export function installationRequiresReinstall(errorMessage: string | null | undefined): boolean {
  return Boolean(errorMessage?.startsWith(SHOPIFY_REINSTALL_REQUIRED_PREFIX));
}
