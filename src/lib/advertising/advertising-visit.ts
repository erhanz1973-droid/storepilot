import { cookies } from "next/headers";

export const ADVERTISING_VISIT_COOKIE = "storepilot_advertising_last_visit";

export type AdvertisingVisitSnapshot = {
  visitedAt: string;
  healthScore: number;
  profit30d: number;
  criticalCampaignCount: number;
  opportunityCount: number;
  blendedRoas: number;
};

export async function readAdvertisingVisitSnapshot(): Promise<AdvertisingVisitSnapshot | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADVERTISING_VISIT_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdvertisingVisitSnapshot;
  } catch {
    return null;
  }
}

export async function writeAdvertisingVisitSnapshot(snapshot: AdvertisingVisitSnapshot): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADVERTISING_VISIT_COOKIE, JSON.stringify(snapshot), {
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
    sameSite: "lax",
  });
}

export function buildVisitSnapshot(input: {
  healthScore: number;
  profit30d: number;
  criticalCampaignCount: number;
  opportunityCount: number;
  blendedRoas: number;
}): AdvertisingVisitSnapshot {
  return {
    visitedAt: new Date().toISOString(),
    ...input,
  };
}
