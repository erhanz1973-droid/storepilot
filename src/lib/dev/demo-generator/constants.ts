/** Prefix for demo rows — used to identify and clear generated data. */
export const DEMO_GID_PREFIX = "gid://storepilot-demo/";

export const DEMO_CUSTOMER_COUNT = 50;
export const DEMO_ORDER_COUNT = 100;
export const DEMO_REFUND_RATE = 0.1;
export const DEMO_LOW_STOCK_COUNT = 3;
export const DEMO_OUT_OF_STOCK_COUNT = 2;

export const DEMO_ORDER_WINDOW_DAYS = 90;

export type DemoGeneratorAction =
  | "generate-customers"
  | "generate-orders"
  | "generate-refunds"
  | "generate-inventory"
  | "clear";
