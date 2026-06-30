import type { CopilotIntent } from "./types";

export type IntelligenceDomain =
  | "customer"
  | "marketing"
  | "inventory"
  | "product"
  | "sales"
  | "executive";

const CUSTOMER_PATTERNS = [
  "top customer",
  "best customer",
  "highest spend",
  "lifetime value",
  "ltv",
  "repeat buyer",
  "repeat customer",
  "returning customer",
  "new customer",
  "customer segment",
  "vip customer",
  "churn",
  "cohort",
  "purchase frequency",
  "rfm",
  "who are my customer",
  "who are my top",
  "my customers",
  "customer analytics",
  "customer intelligence",
  "average order value",
  "aov",
];

const MARKETING_PATTERNS = [
  "roas",
  "campaign",
  " ad ",
  "ads ",
  "advertising",
  "cpa",
  "meta ads",
  "facebook ads",
  "google ads",
  "tiktok ads",
  "ad spend",
  "creative",
  "pause campaign",
];

const INVENTORY_PATTERNS = [
  "inventory",
  "in stock",
  "out of stock",
  "dead inventory",
  "overstock",
  "restock",
  "stock level",
  "days of stock",
  "low stock",
];

const PRODUCT_PATTERNS = [
  "best seller",
  "bestseller",
  "product profit",
  "sku",
  "product margin",
  "product catalog",
  "which product",
  "what product",
  "product intelligence",
  "merchandising",
];

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(p));
}

/** Classify which intelligence module should answer the question. */
export function classifyIntelligenceDomain(question: string): IntelligenceDomain | null {
  const q = ` ${question.toLowerCase()} `;

  if (includesAny(q, CUSTOMER_PATTERNS)) {
    return "customer";
  }
  if (/\bcustomers?\b/.test(q) && !includesAny(q, ["campaign", " roas", "cpa", " ad ", "ads ", "acquisition channel"])) {
    return "customer";
  }
  if (includesAny(q, MARKETING_PATTERNS)) {
    return "marketing";
  }
  if (includesAny(q, INVENTORY_PATTERNS)) {
    return "inventory";
  }
  if (includesAny(q, PRODUCT_PATTERNS) || /\bproducts?\b/.test(q)) {
    return "product";
  }

  return null;
}

export function isCustomerQuery(question: string, pageContext?: string): boolean {
  if (pageContext === "customers") return true;
  return classifyIntelligenceDomain(question) === "customer";
}

export function isTopCustomersQuery(question: string): boolean {
  const q = question.toLowerCase();
  return (
    q.includes("top customer") ||
    q.includes("best customer") ||
    q.includes("highest spend") ||
    q.includes("who are my top") ||
    (q.includes("top") && q.includes("customer"))
  );
}

/** Map domain + question to a copilot intent (called before legacy keyword rules). */
export function domainIntent(
  question: string,
  pageContext?: string,
): CopilotIntent | null {
  const domain = pageContext === "customers"
    ? "customer"
    : classifyIntelligenceDomain(question);

  if (domain === "customer") {
    return isTopCustomersQuery(question) ? "customer_top" : "customer_intelligence";
  }

  if (domain === "inventory") {
    if (question.toLowerCase().includes("dead")) return "inventory_intelligence";
    return "restock";
  }

  if (domain === "product") {
    const q = question.toLowerCase();
    if (q.includes("budget") || q.includes("more ads") || q.includes("deserve")) {
      return "product_ads_budget";
    }
    if (q.includes("losing") || q.includes("hurt") || q.includes("profit")) {
      return "product_profit_hurt";
    }
    return "product_intelligence";
  }

  if (domain === "marketing") {
    const q = question.toLowerCase();
    if (q.includes("pause") || q.includes("stop")) return "pause_campaigns";
    if (q.includes("roas") && q.includes("meta")) return "roas_meta_compare";
    if (q.includes("google") && q.includes("roas")) return "roas_google";
    if (q.includes("roas")) return "roas_decrease";
    if ((q.includes("channel") || q.includes("marketing")) && (q.includes("best") || q.includes("top"))) {
      return "best_channel";
    }
    return "marketing_intelligence";
  }

  return null;
}
