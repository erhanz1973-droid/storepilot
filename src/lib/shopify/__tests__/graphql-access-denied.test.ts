import { describe, expect, it } from "vitest";
import {
  isDiscountAccessDeniedMessage,
  isGraphQLFieldAccessDenied,
} from "@/lib/shopify/graphql-errors";

describe("isGraphQLFieldAccessDenied", () => {
  it("detects discountNodes access denied errors", () => {
    const errors = [
      {
        message: "Access denied for discountNodes field. Required access: read_discounts",
        path: ["discountNodes"],
      },
    ];
    expect(isGraphQLFieldAccessDenied(errors, "discountNodes")).toBe(true);
  });

  it("detects production Shopify scope error wording", () => {
    const errors = [
      {
        message:
          "Access denied for discountNodes field. Required access: Apps must have `read_discounts` access scope.",
      },
    ];
    expect(isGraphQLFieldAccessDenied(errors, "discountNodes")).toBe(true);
  });

  it("does not flag unrelated field errors", () => {
    const errors = [
      {
        message: "Access denied for orders field. Required access: read_orders",
        path: ["orders"],
      },
    ];
    expect(isGraphQLFieldAccessDenied(errors, "discountNodes")).toBe(false);
  });
});

describe("isDiscountAccessDeniedMessage", () => {
  it("matches read_discounts scope errors", () => {
    expect(
      isDiscountAccessDeniedMessage(
        "Access denied for discountNodes field. Required access: read_discounts",
      ),
    ).toBe(true);
  });
});
