"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DemoScenarioId } from "@/lib/demo/scenarios/types";
import { DEMO_SCENARIO_LIST } from "@/lib/demo/scenarios/registry";

type Props = {
  activeScenarioId: DemoScenarioId;
};

export function DemoScenarioSwitcher({ activeScenarioId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(activeScenarioId);

  function switchScenario(id: DemoScenarioId) {
    if (id === active || pending) return;
    startTransition(async () => {
      const res = await fetch("/api/demo/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: id }),
      });
      if (!res.ok) return;
      setActive(id);
      router.refresh();
    });
  }

  return (
    <div className="demo-scenario-switcher" role="group" aria-label="Demo scenario">
      <span className="demo-scenario-label">Demo Scenario</span>
      <div className="demo-scenario-options">
        {DEMO_SCENARIO_LIST.map((scenario) => (
          <label key={scenario.id} className="demo-scenario-option">
            <input
              type="radio"
              name="demo-scenario"
              value={scenario.id}
              checked={active === scenario.id}
              disabled={pending}
              onChange={() => switchScenario(scenario.id)}
            />
            <span>{scenario.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
