export type ExecutiveModuleId =
  | "executive"
  | "health"
  | "marketing"
  | "sales"
  | "profit"
  | "approvals"
  | "customers"
  | "inventory"
  | "connections";

export type ExecutiveModuleMeta = {
  id: ExecutiveModuleId;
  label: string;
  role: string;
  href: string;
  question: string;
  responsibility: string;
};

export const EXECUTIVE_MODULES: Record<ExecutiveModuleId, ExecutiveModuleMeta> = {
  executive: {
    id: "executive",
    label: "Executive Dashboard",
    role: "CEO",
    href: "/",
    question: "What should I focus on today?",
    responsibility: "Summarize priorities and link to the right module.",
  },
  health: {
    id: "health",
    label: "Health",
    role: "COO",
    href: "/health",
    question: "Which business functions need attention?",
    responsibility: "Diagnose business health — not campaign or ledger detail.",
  },
  marketing: {
    id: "marketing",
    label: "Advertising",
    role: "CMO",
    href: "/advertising",
    question: "How efficiently is advertising driving growth?",
    responsibility: "Explain WHY campaigns underperform — not overall profitability.",
  },
  sales: {
    id: "sales",
    label: "Sales",
    role: "CRO",
    href: "/analytics/sales",
    question: "How can revenue be increased?",
    responsibility: "Revenue drivers, bundles, and customer value — not cost cutting.",
  },
  profit: {
    id: "profit",
    label: "Profit",
    role: "CFO",
    href: "/analytics/profit",
    question: "Where is money being lost?",
    responsibility: "Financial outcomes and recovery dollars — not campaign tactics.",
  },
  approvals: {
    id: "approvals",
    label: "Approval Center",
    role: "Executive Assistant",
    href: "/approvals",
    question: "What actions are ready to execute?",
    responsibility: "Turn recommendations into approved launches.",
  },
  customers: {
    id: "customers",
    label: "Customers",
    role: "CCO",
    href: "/analytics/customers",
    question: "Who are our most valuable customers?",
    responsibility: "Retention and lifetime value intelligence.",
  },
  inventory: {
    id: "inventory",
    label: "Inventory",
    role: "COO",
    href: "/analytics/inventory",
    question: "What stock risks threaten revenue?",
    responsibility: "Stockouts, overstock, and replenishment.",
  },
  connections: {
    id: "connections",
    label: "Connections",
    role: "CTO",
    href: "/connections",
    question: "What data is missing?",
    responsibility: "Integration setup and data quality.",
  },
};

/** Executive story flow — each page leads to the next */
export const EXECUTIVE_STORY_FLOW: ExecutiveModuleId[] = [
  "executive",
  "health",
  "marketing",
  "sales",
  "profit",
  "approvals",
];

const HEALTH_DOMAIN_MODULE: Record<string, ExecutiveModuleId> = {
  profit: "profit",
  marketing: "marketing",
  inventory: "inventory",
  customers: "customers",
  "cash-flow": "profit",
};

export function moduleHref(id: ExecutiveModuleId): string {
  return EXECUTIVE_MODULES[id].href;
}

export function moduleRole(id: ExecutiveModuleId): string {
  return EXECUTIVE_MODULES[id].role;
}

export function healthDomainHref(domainId: string): string {
  const mod = HEALTH_DOMAIN_MODULE[domainId] ?? "health";
  return EXECUTIVE_MODULES[mod].href;
}

export function normalizePlaybookDedupKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(meta|google|ads|campaign|budget|reduce|improve|by)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

export function isPlaybookDuplicate(existing: { dedupKey: string }[], title: string): boolean {
  const key = normalizePlaybookDedupKey(title);
  if (!key) return false;
  return existing.some(
    (item) =>
      item.dedupKey === key ||
      item.dedupKey.includes(key) ||
      key.includes(item.dedupKey),
  );
}
