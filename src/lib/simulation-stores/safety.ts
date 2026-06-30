import { isSimulationStore } from "./db";

/** Autopilot and external actions must never run against simulation stores. */
export async function assertNotSimulationStore(storeId: string, action: string): Promise<void> {
  if (await isSimulationStore(storeId)) {
    throw new Error(`Blocked ${action}: simulation stores cannot trigger external actions`);
  }
}

/** Filter simulation stores from production merchant lists. */
export function excludeSimulationStores<T extends { storeId?: string; id?: string }>(
  rows: T[],
): T[] {
  return rows.filter((r) => {
    const id = r.storeId ?? r.id ?? "";
    return !id.includes("-8001-");
  });
}
