export type NavItem = {
  href: string;
  label: string;
  /** Prefix match for nested routes (e.g. /analytics/*) */
  matchPrefix?: boolean;
  /** Nested items (indented in sidebar) */
  children?: NavItem[];
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [
      { href: "/", label: "Executive" },
      { href: "/health", label: "Health" },
    ],
  },
  {
    id: "advertising",
    label: "Advertising",
    items: [
      { href: "/advertising", label: "Advertising", matchPrefix: true },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    items: [
      { href: "/analytics/marketing", label: "Marketing", matchPrefix: true },
      { href: "/analytics/products", label: "Products", matchPrefix: true },
      { href: "/analytics/customers", label: "Customers", matchPrefix: true },
      { href: "/analytics/profit", label: "Financials", matchPrefix: true },
      { href: "/analytics/traffic", label: "Traffic" },
      { href: "/analytics/sales", label: "Sales" },
      { href: "/analytics/funnel", label: "Funnel" },
      { href: "/analytics/inventory", label: "Inventory" },
      { href: "/analytics/attribution", label: "Attribution" },
    ],
  },
  {
    id: "ai",
    label: "AI",
    items: [
      { href: "/insights", label: "AI Insights" },
      { href: "/decisions", label: "Decisions" },
      { href: "/ask-ai", label: "Ask AI" },
      { href: "/autopilot", label: "Autopilot" },
      { href: "/approvals", label: "Approval Center" },
      { href: "/history", label: "History" },
      { href: "/live", label: "Live" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [{ href: "/reports", label: "Reports" }],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { href: "/settings", label: "Settings" },
      { href: "/connections", label: "Connections", matchPrefix: true },
      { href: "/integration-health", label: "Integration Health" },
      { href: "/feedback", label: "Feedback Center" },
    ],
  },
];

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.matchPrefix) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  if (item.href === "/" && pathname === "/") return true;
  if (item.href !== "/" && pathname === item.href) return true;
  if (pathname === "/analytics/executive" && item.href === "/") return true;
  if (item.children?.some((child) => isNavItemActive(pathname, child))) return true;
  return false;
}

export function flattenNavItems(items: NavItem[]): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    out.push(item);
    if (item.children) out.push(...item.children);
  }
  return out;
}
