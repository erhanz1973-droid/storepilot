import type { CopilotDataSource, CopilotIntent } from "./types";
import { domainIntent } from "./intent-classifier";

export const INTENT_DATA_SOURCES: Record<CopilotIntent, CopilotDataSource[]> = {
  sales_yesterday: ["shopify", "trends", "google_ads", "meta_ads", "profit"],
  sales_decrease: ["shopify", "trends", "profit", "insights"],
  roas_decrease: ["google_ads", "meta_ads", "shopify", "profit", "insights", "trends"],
  roas_meta_compare: ["meta_ads", "profit", "attribution"],
  roas_google: ["google_ads", "profit", "insights"],
  pause_campaigns: ["google_ads", "meta_ads", "insights", "priority_queue"],
  today: ["all"],
  product_ads_budget: ["shopify", "profit", "insights", "priority_queue"],
  product_profit_hurt: ["shopify", "profit", "insights"],
  product_intelligence: ["shopify", "profit", "insights"],
  what_changed_week: ["trends", "shopify", "google_ads", "meta_ads", "profit"],
  biggest_opportunities: ["insights", "priority_queue"],
  biggest_risk: ["profit", "attribution", "customers", "shopify", "store_health", "insights"],
  best_channel: ["attribution", "google_ads", "meta_ads", "profit"],
  store_health_explain: ["store_health", "insights", "trends", "profit"],
  predict_revenue: ["shopify", "trends", "profit", "predictions"],
  restock: ["shopify", "insights"],
  inventory_intelligence: ["shopify", "insights"],
  profit_decrease: ["profit", "shopify", "trends"],
  customer_top: ["customers", "shopify"],
  customer_intelligence: ["customers", "shopify", "attribution"],
  marketing_intelligence: ["google_ads", "meta_ads", "profit", "attribution", "insights"],
  plan_campaign_locked: ["meta_ads", "google_ads"],
  general: ["insights", "priority_queue", "trends", "profit"],
};

export function detectCopilotIntent(question: string, pageContext?: string): CopilotIntent {
  const q = question.toLowerCase();

  const classified = domainIntent(question, pageContext);
  if (classified) return classified;

  if (q.includes("yesterday") && (q.includes("sales") || q.includes("revenue") || q.includes("drop") || q.includes("decrease"))) {
    return "sales_yesterday";
  }
  if (
    (q.includes("sales") || q.includes("revenue")) &&
    (q.includes("decrease") || q.includes("drop") || q.includes("down") || q.includes("why"))
  ) {
    return "sales_decrease";
  }
  if (q.includes("roas") && (q.includes("meta") || q.includes("facebook")) && (q.includes("compare") || q.includes("vs") || q.includes("blended"))) {
    return "roas_meta_compare";
  }
  if (q.includes("google") && q.includes("roas")) return "roas_google";
  if (q.includes("roas") && (q.includes("decrease") || q.includes("drop") || q.includes("down") || q.includes("why"))) {
    return "roas_decrease";
  }
  if (
    (q.includes("pause") || q.includes("stop")) &&
    (q.includes("campaign") || q.includes("ad"))
  ) {
    return "pause_campaigns";
  }
  if (
    q.includes("what should i do") ||
    q.includes("do today") ||
    q.includes("focus today") ||
    (q.includes("today") && (q.includes("should") || q.includes("focus")))
  ) {
    return "today";
  }
  if (
    (q.includes("product") || q.includes("products")) &&
    (q.includes("budget") || q.includes("more ads") || q.includes("deserve"))
  ) {
    return "product_ads_budget";
  }
  if (
    (q.includes("product") || q.includes("sku")) &&
    (q.includes("hurt") || q.includes("losing") || q.includes("dragging")) &&
    (q.includes("profit") || q.includes("margin"))
  ) {
    return "product_profit_hurt";
  }
  if (q.includes("what changed") || (q.includes("this week") && q.includes("change"))) {
    return "what_changed_week";
  }
  if (q.includes("biggest opportunit") || q.includes("show opportunit") || q.includes("top opportunit")) {
    return "biggest_opportunities";
  }
  if (q.includes("biggest risk") || q.includes("main risk") || q.includes("worst risk")) {
    return "biggest_risk";
  }
  if (
    (q.includes("channel") || q.includes("marketing")) &&
    (q.includes("best") || q.includes("perform") || q.includes("top"))
  ) {
    return "best_channel";
  }
  if (q.includes("store health") || q.includes("health score")) {
    return "store_health_explain";
  }
  if (q.includes("predict") && (q.includes("revenue") || q.includes("sales") || q.includes("next week"))) {
    return "predict_revenue";
  }
  if (q.includes("restock") || (q.includes("inventory") && q.includes("which"))) {
    return "restock";
  }
  if (q.includes("profit") && (q.includes("decrease") || q.includes("drop") || q.includes("why"))) {
    return "profit_decrease";
  }
  return "general";
}

export function resolveFollowUpIntent(
  question: string,
  lastIntent: CopilotIntent | undefined,
  pageContext?: string,
): { intent: CopilotIntent; expandedQuestion: string } {
  const q = question.toLowerCase();

  if (!lastIntent) {
    return { intent: detectCopilotIntent(question, pageContext), expandedQuestion: question };
  }

  if (q.includes("last week") || q.includes("this week")) {
    if (lastIntent === "roas_decrease") {
      return { intent: "roas_decrease", expandedQuestion: "Why did ROAS decrease this week?" };
    }
    if (lastIntent === "sales_decrease" || lastIntent === "sales_yesterday") {
      return { intent: "what_changed_week", expandedQuestion: "What changed this week with sales?" };
    }
  }

  if (q.includes("yesterday") && (lastIntent === "sales_decrease" || lastIntent === "what_changed_week")) {
    return { intent: "sales_yesterday", expandedQuestion: "Why did sales decrease yesterday?" };
  }

  if ((q.includes("meta") || q.includes("facebook")) && lastIntent === "roas_decrease") {
    return { intent: "roas_meta_compare", expandedQuestion: "Compare Meta ROAS with blended ROAS" };
  }

  if (q.includes("google") && lastIntent === "roas_decrease") {
    return { intent: "roas_google", expandedQuestion: "How is Google Ads ROAS performing?" };
  }

  if (q.includes("pause") && lastIntent === "roas_decrease") {
    return { intent: "pause_campaigns", expandedQuestion: "Which campaigns should I pause?" };
  }

  if ((q.includes("opportunit") || q.includes("what should")) && lastIntent === "biggest_risk") {
    return { intent: "biggest_opportunities", expandedQuestion: "Show my biggest opportunities" };
  }

  if (q.includes("wait") || q.includes("do nothing") || q.includes("if i delay")) {
    return { intent: lastIntent, expandedQuestion: question };
  }

  if (q.includes("why") && (q.includes("first") || q.includes("top") || q.includes("priority"))) {
    return { intent: lastIntent, expandedQuestion: question };
  }

  return { intent: detectCopilotIntent(question, pageContext), expandedQuestion: question };
}

export function intentNeedsFullBundle(intent: CopilotIntent): boolean {
  return INTENT_DATA_SOURCES[intent].includes("all");
}
