import type { ImplementationEffort } from "@/lib/types";

const EFFORT_MINUTES: Record<ImplementationEffort, number> = {
  Low: 10,
  Medium: 25,
  High: 60,
};

export function implementationEffortMinutes(effort: ImplementationEffort): number {
  return EFFORT_MINUTES[effort];
}
