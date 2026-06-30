import type { ExecutionProvider } from "@/lib/execution/provider";
import { metaPauseCampaignHandler } from "./pause-campaign";

export const metaProvider: ExecutionProvider = {
  platform: "meta_ads",
  label: "Meta Ads",
  handlers: [metaPauseCampaignHandler],
};
