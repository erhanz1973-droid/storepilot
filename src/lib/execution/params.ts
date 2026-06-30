import type { ShopifyCollection, ShopifyProduct } from "@/lib/connectors/types";
import type { FutureActionType } from "@/lib/insights/actions";

export type ExecutionParams = {
  discountPercent?: number;
  discountCode?: string;
  durationDays?: number;
  collectionId?: string;
  collectionName?: string;
  partnerProductId?: string;
  partnerProductName?: string;
  productIds?: string[];
  productNames?: string[];
};

export function resolveExecutionParams(input: {
  actionType: FutureActionType;
  entityId: string;
  entityName: string;
  params?: ExecutionParams;
  products?: ShopifyProduct[];
  collections?: ShopifyCollection[];
}): ExecutionParams {
  const base = { ...input.params };

  if (input.actionType === "create_automatic_discount" || input.actionType === "create_discount") {
    const productIds =
      base.productIds && base.productIds.length > 0
        ? base.productIds
        : [input.entityId];
    return {
      ...base,
      discountPercent: base.discountPercent ?? 15,
      durationDays: base.durationDays ?? 14,
      productIds,
    };
  }

  if (input.actionType === "create_discount_code") {
    const slug = input.entityName
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 8)
      .toUpperCase();
    return {
      discountPercent: base.discountPercent ?? 20,
      discountCode: base.discountCode ?? `CLEAR${slug || "20"}`.slice(0, 20),
      durationDays: base.durationDays ?? 7,
      ...base,
    };
  }

  if (input.actionType === "create_bundle" || input.actionType === "create_promotion") {
    const partner =
      base.partnerProductId && input.products
        ? input.products.find((p) => p.id === base.partnerProductId)
        : undefined;
    if (!base.partnerProductId && input.products) {
      const partnerCandidate = input.products.find(
        (p) => p.id !== input.entityId && p.tags.includes("bundle-candidate"),
      );
      if (partnerCandidate) {
        base.partnerProductId = partnerCandidate.id;
        base.partnerProductName = partnerCandidate.title;
      }
    }
    return {
      discountPercent: base.discountPercent ?? 10,
      durationDays: base.durationDays ?? 30,
      partnerProductId: base.partnerProductId ?? partner?.id,
      partnerProductName: base.partnerProductName ?? partner?.title,
      ...base,
    };
  }

  if (input.actionType === "add_to_collection") {
    const collection =
      base.collectionId && input.collections
        ? input.collections.find((c) => c.id === base.collectionId)
        : input.collections?.find((c) =>
            c.title.toLowerCase().includes((base.collectionName ?? "clearance").toLowerCase()),
          );
    return {
      collectionName: base.collectionName ?? "Clearance",
      collectionId: base.collectionId ?? collection?.id,
      ...base,
    };
  }

  return base;
}

export function discountWindow(durationDays: number): { startsAt: string; endsAt: string } {
  const startsAt = new Date();
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + durationDays);
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}
