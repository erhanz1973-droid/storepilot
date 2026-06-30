/** Default Shopify Payments–style estimate when per-order fees are unavailable */
export const DEFAULT_TRANSACTION_FEE_RATE = 0.029;
export const DEFAULT_TRANSACTION_FEE_FIXED = 0.3;

/** Fallback COGS when no Shopify/manual cost exists (45% of price) */
export const ESTIMATED_COGS_RATE = 0.45;

export const PROFIT_WINDOW_LABELS: Record<
  import("./types").ProfitWindow,
  string
> = {
  today: "Today",
  yesterday: "Yesterday",
  last7d: "Last 7 Days",
  last30d: "Last 30 Days",
};
