import type { DecisionItem } from "@/lib/decisions/center";
import { DEAD_INVENTORY_GROUP_KEY } from "@/lib/insights/business-action-groups";

const SEVERITY_RANK: Record<DecisionItem["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Stable key for one business problem — never show two cards for the same problem. */
export function decisionProblemKey(item: DecisionItem): string {
  if (item.groupKey) return item.groupKey;
  if (item.isGroupedAction) return item.opportunityKey ?? item.id;

  const summary = item.summary.toLowerCase();
  if (summary.includes("dead inventory")) return DEAD_INVENTORY_GROUP_KEY;

  if (item.entityType === "product" && item.entityId) {
    if (summary.includes("slow") || summary.includes("pricing")) {
      return `slow_inventory:${item.entityId}`;
    }
    if (item.source === "recommendation") {
      return `product_rec:${item.entityId}:${item.recommendationId ?? item.id}`;
    }
    return `product:${item.entityId}`;
  }

  if (item.entityType === "campaign" && item.entityId) {
    return `campaign:${item.entityId}`;
  }

  if (item.recommendationId) return `rec:${item.recommendationId}`;
  if (item.opportunityKey) return `opp:${item.opportunityKey}`;

  return `title:${summary.trim()}`;
}

function mergeMetrics(
  base: DecisionItem["supportingMetrics"],
  extra: DecisionItem["supportingMetrics"],
): DecisionItem["supportingMetrics"] {
  const seen = new Set(base.map((m) => m.label));
  const merged = [...base];
  for (const metric of extra) {
    if (!seen.has(metric.label)) {
      merged.push(metric);
      seen.add(metric.label);
    }
  }
  return merged;
}

function pickPrimary(items: DecisionItem[]): DecisionItem {
  return [...items].sort((a, b) => {
    const rank = SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority];
    if (rank !== 0) return rank;
    return b.priorityScore - a.priorityScore || b.confidencePct - a.confidencePct;
  })[0]!;
}

/**
 * Collapse duplicate decisions that describe the same underlying business problem.
 * Evidence from merged items is combined; the highest-priority item becomes the card.
 */
export function mergeDuplicateDecisions(items: DecisionItem[]): DecisionItem[] {
  const groups = new Map<string, DecisionItem[]>();

  for (const item of items) {
    const key = decisionProblemKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const merged: DecisionItem[] = [];

  for (const [problemKey, group] of groups) {
    if (group.length === 1) {
      merged.push({ ...group[0]!, problemKey } as DecisionItem & { problemKey?: string });
      continue;
    }

    const primary = pickPrimary(group);
    const mergedIds = group.filter((g) => g.id !== primary.id).map((g) => g.id);
    const allMetrics = group.reduce(
      (acc, g) => mergeMetrics(acc, g.supportingMetrics),
      primary.supportingMetrics,
    );

    const combinedWhy =
      primary.why +
      (mergedIds.length > 0
        ? `\n\nConsolidated from ${group.length} related signals for the same business problem.`
        : "");

    merged.push({
      ...primary,
      supportingMetrics: allMetrics,
      why: combinedWhy,
      priorityScore: Math.max(...group.map((g) => g.priorityScore)),
      confidencePct: Math.round(
        group.reduce((sum, g) => sum + g.confidencePct, 0) / group.length,
      ),
      mergedFrom: mergedIds,
      problemKey,
    } as DecisionItem & { mergedFrom?: string[]; problemKey?: string });
  }

  return merged.sort(
    (a, b) =>
      SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority] ||
      b.priorityScore - a.priorityScore ||
      b.confidencePct - a.confidencePct,
  );
}

/** Skip per-SKU recommendations when a grouped dead-inventory decision already covers them. */
export function filterShadowedByGroupedDeadInventory(
  items: DecisionItem[],
  groupedProductIds: Set<string>,
): DecisionItem[] {
  const hasGroupedDead = items.some(
    (i) => i.groupKey === DEAD_INVENTORY_GROUP_KEY || i.summary.toLowerCase().includes("dead inventory"),
  );
  if (!hasGroupedDead) return items;

  return items.filter((item) => {
    if (item.groupKey === DEAD_INVENTORY_GROUP_KEY || item.isGroupedAction) return true;
    if (item.entityType === "product" && item.entityId && groupedProductIds.has(item.entityId)) {
      const summary = item.summary.toLowerCase();
      if (
        summary.includes("slow") ||
        summary.includes("dead") ||
        summary.includes("inventory") ||
        item.source === "recommendation"
      ) {
        return false;
      }
    }
    return true;
  });
}
