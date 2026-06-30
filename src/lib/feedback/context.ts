import { getDataSourceStatuses } from "@/lib/connectors/registry";
import { resolveActiveStoreId } from "@/lib/store/context";
import { APP_VERSION } from "./constants";
import type { FeedbackContext } from "./types";

export async function buildFeedbackContext(input: {
  page: string;
  browser: string;
  recommendationId?: string | null;
  storeId?: string;
}): Promise<FeedbackContext> {
  const storeId = input.storeId ?? (await resolveActiveStoreId());
  const dataSources = await getDataSourceStatuses(storeId);

  return {
    page: input.page,
    appVersion: APP_VERSION,
    browser: input.browser,
    timestamp: new Date().toISOString(),
    recommendationId: input.recommendationId ?? null,
    integrations: dataSources.map((d) => ({
      id: d.id,
      label: d.label,
      status: d.status,
    })),
  };
}
