import { cookies } from "next/headers";

export const EXECUTIVE_VISIT_COOKIE = "storepilot_executive_last_visit";

export type ExecutiveVisitSnapshot = {
  visitedAt: string;
  estimatedProfit: number;
  businessHealthScore: number;
  recoveryPotential: number;
  openDecisionCount: number;
  threatLabel: string;
};

export async function readExecutiveVisitSnapshot(): Promise<ExecutiveVisitSnapshot | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(EXECUTIVE_VISIT_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExecutiveVisitSnapshot;
  } catch {
    return null;
  }
}

export async function writeExecutiveVisitSnapshot(snapshot: ExecutiveVisitSnapshot): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(EXECUTIVE_VISIT_COOKIE, JSON.stringify(snapshot), {
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
    sameSite: "lax",
  });
}

export function buildExecutiveVisitSnapshot(input: Omit<ExecutiveVisitSnapshot, "visitedAt">): ExecutiveVisitSnapshot {
  return { visitedAt: new Date().toISOString(), ...input };
}
