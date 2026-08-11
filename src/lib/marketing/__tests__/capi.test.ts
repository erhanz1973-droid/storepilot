import { afterEach, describe, expect, it, vi } from "vitest";
import { trackMetaCapiEvent } from "@/lib/marketing/capi";

describe("trackMetaCapiEvent", () => {
  const previousPixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const previousToken = process.env.META_CAPI_ACCESS_TOKEN;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousPixel === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    else process.env.NEXT_PUBLIC_META_PIXEL_ID = previousPixel;
    if (previousToken === undefined) delete process.env.META_CAPI_ACCESS_TOKEN;
    else process.env.META_CAPI_ACCESS_TOKEN = previousToken;
  });

  it("does not call Meta when the pixel id or CAPI token is missing", async () => {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    delete process.env.META_CAPI_ACCESS_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await trackMetaCapiEvent("ConnectShopify");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
