import { cookies } from "next/headers";
import type { MerchantMode } from "@/lib/decisions/merchant-mode";
import { normalizeMerchantMode } from "@/lib/decisions/merchant-mode";

export const MERCHANT_MODE_COOKIE = "storepilot_merchant_mode";

export async function resolveMerchantMode(): Promise<MerchantMode> {
  const cookieStore = await cookies();
  return normalizeMerchantMode(cookieStore.get(MERCHANT_MODE_COOKIE)?.value);
}

export function merchantModeCookieValue(mode: MerchantMode): string {
  return mode;
}
