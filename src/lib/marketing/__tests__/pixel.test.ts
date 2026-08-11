import { afterEach, describe, expect, it } from "vitest";
import { getMetaPixelId, isMetaStandardEvent } from "@/lib/marketing/pixel";

describe("getMetaPixelId", () => {
  const previous = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  afterEach(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    else process.env.NEXT_PUBLIC_META_PIXEL_ID = previous;
  });

  it("returns null when unset", () => {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    expect(getMetaPixelId()).toBeNull();
  });

  it("returns null for a non-numeric value", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "not-a-pixel";
    expect(getMetaPixelId()).toBeNull();
  });

  it("returns a valid numeric pixel id", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "123456789012345";
    expect(getMetaPixelId()).toBe("123456789012345");
  });
});

describe("isMetaStandardEvent", () => {
  it("treats PageView and ViewContent as standard", () => {
    expect(isMetaStandardEvent("PageView")).toBe(true);
    expect(isMetaStandardEvent("ViewContent")).toBe(true);
    expect(isMetaStandardEvent("SignUp")).toBe(false);
    expect(isMetaStandardEvent("ConnectShopify")).toBe(false);
  });
});
