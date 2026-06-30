import { describe, expect, it } from "vitest";
import { formatGoogleAdsApiError } from "@/lib/google-ads/errors";

describe("formatGoogleAdsApiError", () => {
  it("explains DEVELOPER_TOKEN_NOT_APPROVED", () => {
    const raw = JSON.stringify({
      error: {
        code: 403,
        message: "The caller does not have permission",
        details: [
          {
            "@type": "type.googleapis.com/google.ads.googleads.v24.errors.GoogleAdsFailure",
            errors: [
              {
                errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" },
                message: "The developer token is only approved for use with test accounts.",
              },
            ],
          },
        ],
      },
    });
    const msg = formatGoogleAdsApiError(raw, 403);
    expect(msg).toContain("test accounts");
    expect(msg).toContain("Basic or Standard");
  });
});
