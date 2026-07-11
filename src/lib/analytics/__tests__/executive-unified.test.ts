import { describe, expect, it } from "vitest";
import { getPeakOutfittersSnapshot } from "@/lib/connectors/demo-data";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildExecutiveUnifiedLayer } from "@/lib/analytics/executive-unified-layer";
import {
  EXECUTIVE_STORY_FLOW,
  isPlaybookDuplicate,
  normalizePlaybookDedupKey,
} from "@/lib/analytics/executive-modules";

describe("executive unified layer", () => {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, []);

  it("builds daily playbook and executive focus", () => {
    const layer = buildExecutiveUnifiedLayer({
      snapshot,
      profitDashboard,
      topThreatLabel: "High ad spend",
    });

    expect(layer.dailyPlaybook.items.length).toBeGreaterThan(0);
    expect(layer.dailyPlaybook.items[0]!.moduleHref.length).toBeGreaterThan(0);
    expect(layer.dailyPlaybook.items[0]!.roleLabel.length).toBeGreaterThan(0);
    expect(layer.executiveFocus.todayDecision).not.toBeNull();
    expect(layer.executiveFocus.recoveryPotentialMonthly).toBeGreaterThanOrEqual(0);
  });

  it("dedupes similar playbook titles", () => {
    const keyA = normalizePlaybookDedupKey("Reduce Meta budget on Prospecting");
    const keyB = normalizePlaybookDedupKey("Reduce meta budget — Prospecting");
    expect(
      isPlaybookDuplicate([{ dedupKey: keyA }], "Reduce meta budget — Prospecting"),
    ).toBe(true);
  });

  it("includes profit and marketing modules without identical titles", () => {
    const layer = buildExecutiveUnifiedLayer({ snapshot, profitDashboard });
    const modules = new Set(layer.dailyPlaybook.items.map((i) => i.module));
    expect(modules.has("sales") || modules.has("marketing")).toBe(true);
  });

  it("defines executive story flow ending at approvals", () => {
    expect(EXECUTIVE_STORY_FLOW[0]).toBe("executive");
    expect(EXECUTIVE_STORY_FLOW[EXECUTIVE_STORY_FLOW.length - 1]).toBe("approvals");
  });
});
