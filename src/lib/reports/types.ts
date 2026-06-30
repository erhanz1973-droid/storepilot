export type TrendArrow = "up" | "down" | "flat";

export type ScorecardItem = {
  id: string;
  label: string;
  changePct: number | null;
  direction: TrendArrow;
  /** Shown when changePct is null — never raw "—" */
  unavailableReason?: string;
};

export type WinProblemItem = {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  /** Achievement-style wins use checkmark in UI */
  isAchievement?: boolean;
  urgency?: "critical" | "high" | "medium" | "low";
};

export type AiOutcomeStats = {
  generated: number;
  approved: number;
  completed: number;
  estimatedRecovery: number;
  actualRecovery: number;
  accuracyPct: number;
  accuracyAvailable: boolean;
  measurementStatus: string;
  completedProgressLabel: string;
  accuracyEta: string;
};

export type FinancialImpactLine = {
  label: string;
  estimatedMonthly: number;
  measuredMonthly: number | null;
};

export type FinancialImpact = {
  lines: FinancialImpactLine[];
};

export type TimelineEventType =
  | "observation"
  | "recommendation"
  | "approval"
  | "execution"
  | "measurement";

export type TimelineEvent = {
  day: string;
  label: string;
  type: TimelineEventType;
  tone?: "positive" | "neutral" | "action";
};

export type LearningProgress = {
  statusLabel: string;
  description: string;
  completedCount: number;
  minimumRequired: number;
  readinessPct: number;
  currentStage: string;
  nextMilestone: string;
};

export type NextWeekPriority = {
  priority: number;
  title: string;
  impactLabel: string;
  metricLabel?: string;
  metricValue?: string;
};

export type WeeklyBriefingReport = {
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  executive: {
    revenue: number;
    netProfit: number;
    biggestProblem: string;
    biggestOpportunity: string;
    opportunityImpactMonthly: number;
    businessStatus: string;
    statusTone: "positive" | "warning" | "critical";
    narrativeLines: string[];
    /** Consultant-style executive paragraph */
    narrativeParagraph: string;
  };
  scorecard: ScorecardItem[];
  wins: WinProblemItem[];
  problems: WinProblemItem[];
  aiOutcomes: AiOutcomeStats;
  financialImpact: FinancialImpact;
  timeline: TimelineEvent[];
  learning: LearningProgress;
  nextWeekPlan: NextWeekPriority[];
};
