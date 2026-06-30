export type AutopilotRuleHealth =
  | "ready"
  | "monitoring"
  | "waiting"
  | "triggered"
  | "needs_approval"
  | "executing"
  | "completed"
  | "disabled";

export const AUTOPILOT_HEALTH_LABELS: Record<AutopilotRuleHealth, string> = {
  ready: "Ready",
  monitoring: "Monitoring",
  waiting: "Waiting",
  triggered: "Triggered",
  needs_approval: "Needs Approval",
  executing: "Executing",
  completed: "Completed",
  disabled: "Disabled",
};

export type AutopilotRuleCategory =
  | "advertising"
  | "inventory"
  | "store_performance"
  | "customer_intelligence"
  | "executive_reporting";

export type AutopilotRuleDefinition = {
  id: string;
  category: AutopilotRuleCategory;
  title: string;
  summary: string;
  triggerExplanation: string;
  actionExplanation: string;
  defaultEnabled: boolean;
};

export type AutopilotRuleMetric = {
  label: string;
  value: string;
};

export type AutopilotRuleView = AutopilotRuleDefinition & {
  enabled: boolean;
  health: AutopilotRuleHealth;
  healthLabel: string;
  reason: string | null;
  estimatedMonthlyImpact: number;
  confidencePct: number;
  riskLevel: "Low" | "Medium" | "High";
  actionsTriggered: number;
  pendingCount: number;
  metrics: AutopilotRuleMetric[];
};

export type AutopilotRuleGroup = {
  category: AutopilotRuleCategory;
  label: string;
  rules: AutopilotRuleView[];
};

export type AutopilotStatusSummary = {
  activeRules: number;
  pendingApprovals: number;
  estimatedMonthlyImpact: number;
  lastAction: string;
  lastReviewLabel: string;
};

export type AutopilotHistoryItem = {
  id: string;
  dayLabel: string;
  title: string;
  status: AutopilotRuleHealth;
  statusLabel: string;
};

export type AutopilotOperationsView = {
  connected: boolean;
  status: AutopilotStatusSummary;
  groups: AutopilotRuleGroup[];
  history: AutopilotHistoryItem[];
  safetyGuarantees: string[];
  visionStatement: string;
};
