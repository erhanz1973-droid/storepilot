import type { ExecutionActionHandler, ExecutionProvider } from "@/lib/execution/provider";

const notImplementedHandler = (
  actionType: ExecutionActionHandler["actionType"],
  label: string,
): ExecutionActionHandler => ({
  id: `google_ads:${actionType}`,
  platform: "google_ads",
  actionType,
  entityTypes: ["campaign"],
  label,
  async validate() {
    return {
      valid: false,
      errors: [
        `${label} on Google Ads is not implemented yet. Connect Google Ads and use manual execution for now.`,
      ],
    };
  },
});

export const googleAdsProvider: ExecutionProvider = {
  platform: "google_ads",
  label: "Google Ads",
  handlers: [
    notImplementedHandler("pause_campaign", "Pause Campaign"),
    notImplementedHandler("increase_budget", "Increase Budget"),
    notImplementedHandler("decrease_budget", "Decrease Budget"),
    notImplementedHandler("reduce_budget", "Reduce Budget"),
    notImplementedHandler("scale_campaign", "Scale Campaign"),
    notImplementedHandler("enable_campaign", "Enable Campaign"),
  ],
};
