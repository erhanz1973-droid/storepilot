import { cookies } from "next/headers";
import {
  DEFAULT_DEMO_SCENARIO_ID,
  resolveDemoScenarioId,
  type DemoScenarioId,
} from "@/lib/demo/get-demo-snapshot";

export const DEMO_SCENARIO_COOKIE = "storepilot_demo_scenario";

export async function getActiveDemoScenarioId(): Promise<DemoScenarioId> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DEMO_SCENARIO_COOKIE)?.value;
  return resolveDemoScenarioId(raw);
}

export function demoScenarioCookieValue(id: DemoScenarioId): {
  name: string;
  value: string;
  options: { path: string; maxAge: number; sameSite: "lax" };
} {
  return {
    name: DEMO_SCENARIO_COOKIE,
    value: id,
    options: {
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
      sameSite: "lax",
    },
  };
}

export { DEFAULT_DEMO_SCENARIO_ID };
