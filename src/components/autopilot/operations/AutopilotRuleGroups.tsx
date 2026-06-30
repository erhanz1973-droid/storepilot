import type { AutopilotRuleGroup } from "@/lib/autopilot/operations-types";
import { AutopilotRuleCard } from "./AutopilotRuleCard";

export function AutopilotRuleGroups({ groups }: { groups: AutopilotRuleGroup[] }) {
  return (
    <div className="autopilot-ops-groups">
      {groups.map((group) => (
        <section key={group.category} className="autopilot-ops-group">
          <h3 className="autopilot-ops-group-title">{group.label}</h3>
          <div className="autopilot-ops-rule-list">
            {group.rules.map((rule) => (
              <AutopilotRuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
