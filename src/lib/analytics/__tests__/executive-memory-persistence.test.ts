import { afterEach, describe, expect, it } from "vitest";
import {
  __clearExecutiveMemoryForTests,
  executiveMemoryEventsToItems,
  listExecutiveMemoryEvents,
  recordExecutiveMemoryEvent,
} from "@/lib/db/executive-memory";
import { buildExecutiveMemory } from "@/lib/analytics/executive-ai-behavior";

describe("executive memory persistence", () => {
  afterEach(() => {
    __clearExecutiveMemoryForTests();
  });

  it("persists and prefers measured events over derived heuristics", async () => {
    await recordExecutiveMemoryEvent({
      storeId: "demo-store",
      eventType: "measured",
      title: "Pause low ROAS campaign",
      measuredImpactMonthly: 420,
      estimatedImpactMonthly: 500,
      outcomeRating: "successful",
      contextMessage: "Measured $420/mo recovery.",
    });

    const events = await listExecutiveMemoryEvents("demo-store");
    expect(events).toHaveLength(1);

    const items = executiveMemoryEventsToItems(events);
    expect(items[0]?.impactLabel).toContain("measured");
    expect(items[0]?.status).toBe("completed");

    const memory = buildExecutiveMemory({
      decisions: [],
      recommendationRows: [],
      persistedMemory: items,
    });
    expect(memory[0]?.title).toBe("Pause low ROAS campaign");
    expect(memory[0]?.contextMessage).toContain("Measured");
  });
});
