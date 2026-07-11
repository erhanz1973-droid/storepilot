import { cookies } from "next/headers";
import type { AdvertisingCampaignRow } from "@/lib/advertising/types";
import { resolveUnlockedCampaignId } from "./campaign-selection";

export const UNLOCKED_CAMPAIGN_COOKIE = "storepilot_unlocked_campaign_id";

export async function resolveUnlockedCampaignIdFromCookie(
  campaigns: AdvertisingCampaignRow[],
): Promise<string | null> {
  const cookieStore = await cookies();
  const preferred = cookieStore.get(UNLOCKED_CAMPAIGN_COOKIE)?.value ?? null;
  return resolveUnlockedCampaignId(campaigns, preferred);
}
