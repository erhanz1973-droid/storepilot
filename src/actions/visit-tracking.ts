"use server";

import {
  buildVisitSnapshot,
  writeAdvertisingVisitSnapshot,
  type AdvertisingVisitSnapshot,
} from "@/lib/advertising/advertising-visit";
import {
  buildExecutiveVisitSnapshot,
  writeExecutiveVisitSnapshot,
  type ExecutiveVisitSnapshot,
} from "@/lib/analytics/executive-visit";

export async function recordAdvertisingVisitSnapshot(
  input: Omit<AdvertisingVisitSnapshot, "visitedAt">,
): Promise<void> {
  await writeAdvertisingVisitSnapshot(buildVisitSnapshot(input));
}

export async function recordExecutiveVisitSnapshot(
  input: Omit<ExecutiveVisitSnapshot, "visitedAt">,
): Promise<void> {
  await writeExecutiveVisitSnapshot(buildExecutiveVisitSnapshot(input));
}
