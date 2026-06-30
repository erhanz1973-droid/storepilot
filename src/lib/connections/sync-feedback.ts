export type SyncApiResponse = {
  ok?: boolean;
  error?: string;
  syncedAt?: string;
  campaigns?: number;
  products?: number;
  orders30d?: number;
  spend30d?: number;
  sessions30d?: number;
  engagementRatePct?: number;
  ecommerceConversionRatePct?: number;
  warnings?: string[];
};

export type SyncFeedback = {
  kind: "success" | "error";
  message: string;
  detail?: string;
};

export function buildSyncFeedback(
  integrationId: string,
  body: SyncApiResponse,
): SyncFeedback {
  const syncedAt = body.syncedAt
    ? new Date(body.syncedAt).toLocaleString("tr-TR")
    : undefined;

  if (integrationId === "meta_ads") {
    const campaigns = body.campaigns ?? 0;
    const detailParts = [
      syncedAt ? `Son senkron: ${syncedAt}` : null,
      `${campaigns} kampanya güncellendi`,
      body.spend30d != null ? `30 günlük harcama: $${Math.round(body.spend30d).toLocaleString("tr-TR")}` : null,
      body.warnings?.length ? body.warnings.join(" · ") : null,
    ].filter(Boolean);

    return {
      kind: "success",
      message: "Meta Ads senkronizasyonu tamamlandı.",
      detail: detailParts.join(" · "),
    };
  }

  if (integrationId === "shopify") {
    const detailParts = [
      syncedAt ? `Son senkron: ${syncedAt}` : null,
      body.products != null ? `${body.products} ürün` : null,
      body.orders30d != null ? `${body.orders30d} sipariş (30 gün)` : null,
    ].filter(Boolean);

    return {
      kind: "success",
      message: "Shopify senkronizasyonu tamamlandı.",
      detail: detailParts.join(" · "),
    };
  }

  if (integrationId === "google_ads") {
    const detailParts = [
      syncedAt ? `Son senkron: ${syncedAt}` : null,
      body.campaigns != null ? `${body.campaigns} kampanya` : null,
    ].filter(Boolean);

    return {
      kind: "success",
      message: "Google Ads senkronizasyonu tamamlandı.",
      detail: detailParts.join(" · "),
    };
  }

  if (integrationId === "ga4") {
    const detailParts = [
      syncedAt ? `Son senkron: ${syncedAt}` : null,
      body.sessions30d != null ? `${body.sessions30d.toLocaleString("tr-TR")} oturum (30g)` : null,
      body.engagementRatePct != null ? `%${body.engagementRatePct.toFixed(1)} etkileşim` : null,
    ].filter(Boolean);

    return {
      kind: "success",
      message: "GA4 senkronizasyonu tamamlandı.",
      detail: detailParts.join(" · "),
    };
  }

  return {
    kind: "success",
    message: "Senkronizasyon tamamlandı.",
    detail: syncedAt ? `Son senkron: ${syncedAt}` : undefined,
  };
}

export async function runIntegrationSync(
  syncEndpoint: string,
  integrationId: string,
): Promise<SyncFeedback> {
  let response: Response;
  try {
    response = await fetch(syncEndpoint, { method: "POST" });
  } catch {
    return {
      kind: "error",
      message: "Senkronizasyon isteği gönderilemedi.",
      detail: "İnternet bağlantınızı kontrol edip tekrar deneyin.",
    };
  }

  let body: SyncApiResponse = {};
  try {
    body = (await response.json()) as SyncApiResponse;
  } catch {
    body = {};
  }

  if (!response.ok) {
    return {
      kind: "error",
      message: "Senkronizasyon başarısız.",
      detail: body.error ?? `Sunucu hatası (${response.status}).`,
    };
  }

  return buildSyncFeedback(integrationId, body);
}
