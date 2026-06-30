/** Turn raw Google Ads API JSON into a short, actionable message for merchants. */
export function formatGoogleAdsApiError(raw: string, httpStatus?: number): string {
  const trimmed = raw.trim();
  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed;
  }

  const error = (payload as { error?: { message?: string; details?: unknown[] } })?.error;
  const details = error?.details ?? [];
  const failure = details.find(
    (d) =>
      typeof d === "object" &&
      d !== null &&
      String((d as { "@type"?: string })["@type"] ?? "").includes("GoogleAdsFailure"),
  ) as { errors?: { errorCode?: Record<string, string>; message?: string }[] } | undefined;

  const first = failure?.errors?.[0];
  const authCode = first?.errorCode?.authorizationError;
  const apiMessage = first?.message ?? error?.message;

  if (authCode === "DEVELOPER_TOKEN_NOT_APPROVED") {
    return (
      "Google Ads developer token is only approved for test accounts. " +
      "In Google Ads → Tools → API Center, apply for Basic or Standard access, " +
      "or connect a test manager account (manager.test-google.com). " +
      "Until approved, production ad accounts cannot be synced."
    );
  }

  if (authCode === "DEVELOPER_TOKEN_PROHIBITED") {
    return "This Google Ads developer token is not allowed. Check API Center status in Google Ads.";
  }

  if (authCode === "USER_PERMISSION_DENIED" || authCode === "CUSTOMER_NOT_ENABLED") {
    return (
      apiMessage ??
      "Your Google account does not have permission for this Ads customer ID. " +
        "Use an account with admin access, or select a different customer during connect."
    );
  }

  if (httpStatus === 403) {
    return apiMessage ?? error?.message ?? "Google Ads API permission denied (403).";
  }

  if (apiMessage) return apiMessage;
  if (error?.message) return error.message;

  return trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed;
}
