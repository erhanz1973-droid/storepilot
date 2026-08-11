/**
 * Explainable New / Growing / Established rules.
 * Tuned to existing StoreSnapshot metrics (orders30d / revenue30d) and
 * aligned with Merchant DNA startup cutoffs (orders < 30, revenue < $5k)
 * while matching the product spec for brand-new Shopify shops (0–10 orders).
 */

/** New Store: fewer than this many orders in 30d. */
export const NEW_STORE_MAX_ORDERS = 15;

/** New Store: below this revenue (and below the order cap) stays New. */
export const NEW_STORE_MAX_REVENUE = 2500;

/** Growing: at least this many orders, unless already Established. */
export const GROWING_MIN_ORDERS = 15;

/** Growing: at least this much 30d revenue with GROWING_MIN_ORDERS. */
export const GROWING_MIN_REVENUE = 2500;

/** Volume-only Growing path (low AOV but real order flow). */
export const GROWING_VOLUME_ORDERS = 30;

/** Established: order volume. */
export const ESTABLISHED_MIN_ORDERS = 100;

/** Established: revenue. */
export const ESTABLISHED_MIN_REVENUE = 15_000;

/** Product description shorter than this (plain text) needs attention. */
export const SHORT_DESCRIPTION_CHARS = 80;

/** Title shorter than this (trimmed) is incomplete. */
export const SHORT_TITLE_CHARS = 4;

/** Shop created within this window is a supporting "new store" signal only. */
export const NEW_SHOP_AGE_DAYS = 90;

/** Profitability insights stay locked below this order count. */
export const PROFITABILITY_MIN_ORDERS = 15;
