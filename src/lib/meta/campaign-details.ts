import type { MetaCampaign } from "@/lib/connectors/types";
import { formatMetaEffectiveStatusLabel } from "@/lib/meta/campaign-status";

/** Meta Ads Manager objective labels (Turkish UI). */
export const META_OBJECTIVE_LABELS_TR: Record<string, string> = {
  MESSAGES: "Daha fazla mesaj al",
  OUTCOME_MESSAGING: "Daha fazla mesaj al",
  CONVERSATIONS: "Daha fazla mesaj al",
  LINK_CLICKS: "Trafik",
  OUTCOME_TRAFFIC: "Trafik",
  CONVERSIONS: "Dönüşümler",
  OUTCOME_SALES: "Satışlar",
  OUTCOME_LEADS: "Potansiyel müşteriler",
  LEAD_GENERATION: "Potansiyel müşteriler",
  OUTCOME_ENGAGEMENT: "Etkileşim",
  POST_ENGAGEMENT: "Gönderi etkileşimi",
  OUTCOME_AWARENESS: "Tanınırlık",
  BRAND_AWARENESS: "Marka bilinirliği",
  REACH: "Erişim",
  VIDEO_VIEWS: "Video görüntülemeleri",
  APP_INSTALLS: "Uygulama yüklemeleri",
  OUTCOME_APP_PROMOTION: "Uygulama tanıtımı",
  STORE_VISITS: "Mağaza ziyaretleri",
  PRODUCT_CATALOG_SALES: "Katalog satışları",
};

export const META_STATUS_LABELS_TR: Record<string, string> = {
  ACTIVE: "Aktif",
  PAUSED: "Duraklatıldı",
  CAMPAIGN_PAUSED: "Kampanya duraklatıldı",
  ADSET_PAUSED: "Reklam seti duraklatıldı",
  ARCHIVED: "Arşivlendi",
  DELETED: "Silindi",
  IN_PROCESS: "İşleniyor",
  WITH_ISSUES: "Sorunlu",
  PENDING_REVIEW: "İnceleniyor",
  DISAPPROVED: "Reddedildi",
  PREAPPROVED: "Ön onaylı",
  PENDING_BILLING_INFO: "Fatura bilgisi bekleniyor",
};

export type CampaignMetaDetailsView = {
  statusLabel: string;
  objectiveLabel: string;
  dailyBudgetLabel: string;
  durationLabel: string;
};

export function formatMetaObjectiveLabel(
  objective?: string | null,
  locale: "tr" | "en" = "tr",
  hints?: { destinationType?: string | null; optimizationGoal?: string | null },
): string {
  const resolved = resolveMetaObjectiveLabel({
    objective,
    destinationType: hints?.destinationType,
    optimizationGoal: hints?.optimizationGoal,
  });
  if (locale === "tr") return resolved.tr;
  return resolved.en;
}

export function resolveMetaObjectiveLabel(input: {
  objective?: string | null;
  destinationType?: string | null;
  optimizationGoal?: string | null;
}): { tr: string; en: string } {
  const obj = (input.objective ?? "").toUpperCase();
  const dest = (input.destinationType ?? "").toUpperCase();
  const opt = (input.optimizationGoal ?? "").toUpperCase();

  const isMessaging =
    obj === "MESSAGES" ||
    obj === "OUTCOME_MESSAGING" ||
    obj === "CONVERSATIONS" ||
    dest.includes("MESSENGER") ||
    dest.includes("WHATSAPP") ||
    dest.includes("INSTAGRAM_DIRECT") ||
    dest.includes("MESSAGING") ||
    opt.includes("CONVERSATION") ||
    opt.includes("MESSAGING") ||
    opt.includes("REPLY");

  if (isMessaging) {
    return { tr: "Daha fazla mesaj al", en: "Get more messages" };
  }

  const key = obj;
  const tr = META_OBJECTIVE_LABELS_TR[key];
  if (tr) return { tr, en: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };

  const fallback = key ? key.replace(/_/g, " ").toLowerCase() : "not set";
  return {
    tr: key ? fallback : "Belirtilmemiş",
    en: key ? fallback : "Not set",
  };
}

export function formatMetaStatusLabel(
  raw?: string | null,
  locale: "tr" | "en" = "tr",
): string {
  if (!raw) return locale === "tr" ? "Bilinmiyor" : "Unknown";
  const key = raw.toUpperCase();
  if (locale === "tr") {
    return META_STATUS_LABELS_TR[key] ?? formatMetaEffectiveStatusLabel(raw);
  }
  return formatMetaEffectiveStatusLabel(raw);
}

/** Meta stores budgets in the account's minor currency unit (e.g. cents). */
export function formatMetaBudget(
  cents?: number | null,
  currency = "USD",
  locale: "tr" | "en" = "tr",
): string | null {
  if (cents == null || cents <= 0) return null;
  const amount = cents / 100;
  const localeTag = locale === "tr" ? "tr-TR" : "en-US";
  try {
    return new Intl.NumberFormat(localeTag, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function computeCampaignDurationDays(
  startTime?: string | null,
  stopTime?: string | null,
): number | null {
  if (!startTime) return null;
  const start = new Date(startTime).getTime();
  if (Number.isNaN(start)) return null;

  if (stopTime) {
    const end = new Date(stopTime).getTime();
    if (!Number.isNaN(end)) {
      return Math.max(1, Math.ceil((end - start) / 86400000));
    }
  }

  return Math.max(1, Math.ceil((Date.now() - start) / 86400000));
}

export function inferScheduledDurationDays(input: {
  startTime?: string | null;
  stopTime?: string | null;
  dailyBudgetCents?: number | null;
  lifetimeBudgetCents?: number | null;
}): number | null {
  if (input.startTime && input.stopTime) {
    const start = new Date(input.startTime).getTime();
    const end = new Date(input.stopTime).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      return Math.max(1, Math.ceil((end - start) / 86400000));
    }
  }

  const daily = input.dailyBudgetCents ?? 0;
  const lifetime = input.lifetimeBudgetCents ?? 0;
  if (daily > 0 && lifetime > 0) {
    return Math.max(1, Math.round(lifetime / daily));
  }

  return null;
}

export function formatCampaignDuration(
  startTime?: string | null,
  stopTime?: string | null,
  locale: "tr" | "en" = "tr",
  budgetHints?: { dailyBudgetCents?: number | null; lifetimeBudgetCents?: number | null },
): string | null {
  const scheduledDays = inferScheduledDurationDays({
    startTime,
    stopTime,
    dailyBudgetCents: budgetHints?.dailyBudgetCents,
    lifetimeBudgetCents: budgetHints?.lifetimeBudgetCents,
  });
  if (scheduledDays != null) {
    return locale === "tr" ? `${scheduledDays} gün` : `${scheduledDays} days`;
  }

  if (!startTime) return null;
  const start = new Date(startTime).getTime();
  if (Number.isNaN(start)) return null;

  const elapsed = Math.max(1, Math.ceil((Date.now() - start) / 86400000));
  return locale === "tr" ? `${elapsed} gün (geçen)` : `${elapsed} days elapsed`;
}

export function buildCampaignMetaDetails(
  campaign: MetaCampaign,
  locale: "tr" | "en" = "tr",
): CampaignMetaDetailsView {
  const dailyBudget = formatMetaBudget(campaign.dailyBudgetCents, campaign.currency, locale);
  const lifetimeBudget = formatMetaBudget(campaign.lifetimeBudgetCents, campaign.currency, locale);

  let dailyBudgetLabel: string;
  if (dailyBudget) {
    dailyBudgetLabel = dailyBudget;
  } else if (lifetimeBudget) {
    dailyBudgetLabel = locale === "tr" ? `${lifetimeBudget} (toplam)` : `${lifetimeBudget} (lifetime)`;
  } else {
    dailyBudgetLabel = locale === "tr" ? "Belirtilmemiş" : "Not set";
  }

  const durationLabel =
    formatCampaignDuration(campaign.startTime, campaign.stopTime, locale, {
      dailyBudgetCents: campaign.dailyBudgetCents,
      lifetimeBudgetCents: campaign.lifetimeBudgetCents,
    }) ?? (locale === "tr" ? "Belirtilmemiş" : "Not set");

  return {
    statusLabel: formatMetaStatusLabel(campaign.metaEffectiveStatus, locale),
    objectiveLabel: formatMetaObjectiveLabel(campaign.objective, locale, {
      destinationType: campaign.destinationType,
      optimizationGoal: campaign.optimizationGoal,
    }),
    dailyBudgetLabel,
    durationLabel,
  };
}
