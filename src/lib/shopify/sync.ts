import type {
  ProfitOrderBucket,
  ProfitOrderRollups,
  ShopifyCollection,
  ShopifyProduct,
  StoreSnapshot,
} from "@/lib/connectors/types";
import type { CommerceOrder } from "@/lib/commerce/types";
import { ESTIMATED_COGS_RATE } from "@/lib/profit/constants";
import { computeDailyRevenueMetrics } from "@/lib/ads/daily-metrics";
import { computeProductOrderStats } from "@/lib/products/enrich";
import { mergeDailyMetrics } from "@/lib/profit/roas";
import { paginateGraphQL, shopifyGraphQL, type ShopifyGraphQLContext } from "./graphql-client";
import { handleShopifyAuthFailure } from "./handle-auth-failure";

export type ShopifySyncStats = {
  productCount: number;
  inventoryCount: number;
  orderCount: number;
  customerCount: number;
  collectionCount: number;
  discountCount: number;
};

export type ShopifySyncResult = {
  snapshot: Partial<StoreSnapshot>;
  stats: ShopifySyncStats;
  shopName: string;
  shopifyPlan: string;
};

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 50, after: $cursor) {
      edges {
        node {
          id
          title
          tags
          featuredImage { url }
          totalInventory
          variants(first: 20) {
            edges {
              node {
                price
                compareAtPrice
                inventoryQuantity
                inventoryItem {
                  tracked
                  unitCost {
                    amount
                  }
                }
              }
            }
          }
          collections(first: 10) {
            edges { node { id } }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const ORDERS_QUERY = `
  query Orders($cursor: String, $query: String) {
    orders(first: 50, after: $cursor, query: $query) {
      edges {
        node {
          id
          createdAt
          totalPriceSet { shopMoney { amount } }
          totalShippingPriceSet { shopMoney { amount } }
          totalRefundedSet { shopMoney { amount } }
          email
          customer {
            id
            email
          }
          lineItems(first: 50) {
            edges {
              node {
                quantity
                product { id }
                originalTotalSet { shopMoney { amount } }
                discountedTotalSet { shopMoney { amount } }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const COLLECTIONS_QUERY = `
  query Collections($cursor: String) {
    collections(first: 50, after: $cursor) {
      edges {
        node {
          id
          title
          productsCount { count }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const SHOP_QUERY = `
  query ShopInfo {
    shop {
      name
      myshopifyDomain
      plan { displayName }
      currencyCode
    }
    customersCount { count }
    discountNodes(first: 1) {
      edges { node { id } }
    }
  }
`;

const DISCOUNTS_COUNT_QUERY = `
  query DiscountCount($cursor: String) {
    discountNodes(first: 50, after: $cursor) {
      edges { node { id } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

type RawProduct = {
  id: string;
  title: string;
  tags: string[];
  featuredImage?: { url: string } | null;
  totalInventory: number;
  variants: {
    edges: {
      node: {
        price: string;
        compareAtPrice: string | null;
        inventoryQuantity: number | null;
        inventoryItem?: {
          tracked?: boolean;
          unitCost?: { amount: string } | null;
        } | null;
      };
    }[];
  };
  collections: { edges: { node: { id: string } }[] };
};

type RawOrder = {
  id: string;
  createdAt: string;
  email?: string | null;
  customer?: { id: string; email?: string | null } | null;
  totalPriceSet: { shopMoney: { amount: string } };
  totalShippingPriceSet?: { shopMoney: { amount: string } } | null;
  totalRefundedSet?: { shopMoney: { amount: string } } | null;
  lineItems: {
    edges: {
      node: {
        quantity: number;
        product: { id: string } | null;
        originalTotalSet: { shopMoney: { amount: string } };
        discountedTotalSet?: { shopMoney: { amount: string } } | null;
      };
    }[];
  };
};

type RawCollection = {
  id: string;
  title: string;
  productsCount: { count: number };
};

function sixtyDayQuery(): string {
  const d = new Date();
  d.setDate(d.getDate() - 60);
  return `created_at:>=${d.toISOString().split("T")[0]}`;
}

function periodFromOrders(orders: number, revenue: number) {
  return {
    revenue: Math.round(revenue * 100) / 100,
    orders,
    aov: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0,
  };
}

export function computeSalesTrends(orders: RawOrder[], now = new Date()) {
  const nowMs = now.getTime();
  const dayMs = 86400000;

  let thisWeekRev = 0;
  let thisWeekOrders = 0;
  let lastWeekRev = 0;
  let lastWeekOrders = 0;
  let last30Rev = 0;
  let last30Orders = 0;
  let prev30Rev = 0;
  let prev30Orders = 0;

  for (const order of orders) {
    const createdMs = new Date(order.createdAt).getTime();
    const ageDays = (nowMs - createdMs) / dayMs;
    const amount = parseFloat(order.totalPriceSet.shopMoney.amount);

    if (ageDays <= 7) {
      thisWeekOrders += 1;
      thisWeekRev += amount;
    }
    if (ageDays > 7 && ageDays <= 14) {
      lastWeekOrders += 1;
      lastWeekRev += amount;
    }
    if (ageDays <= 30) {
      last30Orders += 1;
      last30Rev += amount;
    }
    if (ageDays > 30 && ageDays <= 60) {
      prev30Orders += 1;
      prev30Rev += amount;
    }
  }

  return {
    thisWeek: periodFromOrders(thisWeekOrders, thisWeekRev),
    lastWeek: periodFromOrders(lastWeekOrders, lastWeekRev),
    last30Days: periodFromOrders(last30Orders, last30Rev),
    previous30Days: periodFromOrders(prev30Orders, prev30Rev),
  };
}

function thirtyDayQuery(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `created_at:>=${d.toISOString().split("T")[0]}`;
}

export async function syncShopifyStore(
  shop: string,
  accessToken: string,
  options?: { storedClientId?: string | null },
): Promise<ShopifySyncResult> {
  const graphqlContext: ShopifyGraphQLContext = {
    shopDomain: shop,
    storedClientId: options?.storedClientId,
  };

  try {
    return await syncShopifyStoreInner(shop, accessToken, graphqlContext);
  } catch (error) {
    return handleShopifyAuthFailure(shop, error);
  }
}

async function syncShopifyStoreInner(
  shop: string,
  accessToken: string,
  graphqlContext: ShopifyGraphQLContext,
): Promise<ShopifySyncResult> {
  const shopInfo = await shopifyGraphQL<{
    shop: { name: string; myshopifyDomain: string; plan: { displayName: string }; currencyCode: string };
    customersCount: { count: number };
  }>(shop, accessToken, SHOP_QUERY, undefined, graphqlContext);

  const rawProducts = await paginateGraphQL<RawProduct, RawProduct[]>(
    shop,
    accessToken,
    PRODUCTS_QUERY,
    (data) => {
      const conn = data.products as {
        edges: { node: RawProduct }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
      return {
        nodes: conn.edges.map((e) => e.node),
        hasNextPage: conn.pageInfo.hasNextPage,
        endCursor: conn.pageInfo.endCursor,
      };
    },
    (acc, nodes) => acc.concat(nodes),
    [],
    graphqlContext,
  );

  const orderQuery = sixtyDayQuery();
  const rawOrders = await fetchAllOrders(shop, accessToken, orderQuery, graphqlContext);

  const rawCollections = await paginateGraphQL<RawCollection, RawCollection[]>(
    shop,
    accessToken,
    COLLECTIONS_QUERY,
    (data) => {
      const conn = data.collections as {
        edges: { node: RawCollection }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
      return {
        nodes: conn.edges.map((e) => e.node),
        hasNextPage: conn.pageInfo.hasNextPage,
        endCursor: conn.pageInfo.endCursor,
      };
    },
    (acc, nodes) => acc.concat(nodes),
    [],
    graphqlContext,
  );

  const discountCount = await countDiscounts(shop, accessToken, graphqlContext);

  const salesByProduct = aggregateProductSales(
    rawOrders.filter((o) => {
      const ageDays = (Date.now() - new Date(o.createdAt).getTime()) / 86400000;
      return ageDays <= 30;
    }),
  );
  const unitCostByProduct = buildUnitCostMap(rawProducts);
  const products = transformProducts(rawProducts, salesByProduct, unitCostByProduct);
  const collections = transformCollections(rawCollections, products);
  const last30Orders = rawOrders.filter((o) => {
    const ageDays = (Date.now() - new Date(o.createdAt).getTime()) / 86400000;
    return ageDays <= 30;
  });
  const storeMetrics = computeStoreMetrics(last30Orders);
  const salesTrends = computeSalesTrends(rawOrders);
  const profitRollups = computeProfitRollups(rawOrders, unitCostByProduct);
  const revenueByDate = computeDailyRevenueMetrics(rawOrders, 90);
  const dailyMetrics = mergeDailyMetrics(revenueByDate, new Map());

  const productOrderStatsMap = computeProductOrderStats(rawOrders);
  const productOrderStats = Object.fromEntries(productOrderStatsMap);
  const commerceOrders = transformCommerceOrders(rawOrders, unitCostByProduct);

  const inventoryCount = products.reduce((s, p) => s + p.inventoryQuantity, 0);

  const stats: ShopifySyncStats = {
    productCount: products.length,
    inventoryCount,
    orderCount: last30Orders.length,
    customerCount: shopInfo.customersCount.count,
    collectionCount: rawCollections.length,
    discountCount,
  };

  return {
    snapshot: {
      source: "connected",
      syncedAt: new Date().toISOString(),
      products,
      collections,
      storeMetrics,
      salesTrends,
      profitRollups,
      dailyMetrics,
      productOrderStats,
      commerceOrders,
      shopifyCustomersCount: shopInfo.customersCount.count,
    },
    stats,
    shopName: shopInfo.shop.name,
    shopifyPlan: shopInfo.shop.plan.displayName,
  };
}

type OrdersQueryResult = {
  orders: {
    edges: { node: RawOrder }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

type DiscountQueryResult = {
  discountNodes: {
    edges: { node: { id: string } }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

async function fetchAllOrders(
  shop: string,
  accessToken: string,
  query: string,
  context?: ShopifyGraphQLContext,
): Promise<RawOrder[]> {
  let cursor: string | null = null;
  let hasNextPage = true;
  const orders: RawOrder[] = [];

  while (hasNextPage) {
    const data: OrdersQueryResult = await shopifyGraphQL<OrdersQueryResult>(
      shop,
      accessToken,
      ORDERS_QUERY,
      { cursor, query },
      context,
    );
    orders.push(...data.orders.edges.map((e: { node: RawOrder }) => e.node));
    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor = data.orders.pageInfo.endCursor;
  }

  return orders;
}

async function countDiscounts(
  shop: string,
  accessToken: string,
  context?: ShopifyGraphQLContext,
): Promise<number> {
  let cursor: string | null = null;
  let hasNextPage = true;
  let count = 0;

  while (hasNextPage) {
    const data: DiscountQueryResult = await shopifyGraphQL<DiscountQueryResult>(
      shop,
      accessToken,
      DISCOUNTS_COUNT_QUERY,
      { cursor },
      context,
    );
    count += data.discountNodes.edges.length;
    hasNextPage = data.discountNodes.pageInfo.hasNextPage;
    cursor = data.discountNodes.pageInfo.endCursor;
  }

  return count;
}

function aggregateProductSales(orders: RawOrder[]): Map<string, { units: number; revenue: number }> {
  const map = new Map<string, { units: number; revenue: number }>();

  for (const order of orders) {
    for (const { node } of order.lineItems.edges) {
      if (!node.product?.id) continue;
      const existing = map.get(node.product.id) ?? { units: 0, revenue: 0 };
      existing.units += node.quantity;
      existing.revenue += parseFloat(node.originalTotalSet.shopMoney.amount);
      map.set(node.product.id, existing);
    }
  }

  return map;
}

function emptyBucket(): ProfitOrderBucket {
  return { revenue: 0, cogs: 0, shipping: 0, refunds: 0, orders: 0 };
}

function buildUnitCostMap(raw: RawProduct[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of raw) {
    for (const { node } of p.variants.edges) {
      const amount = node.inventoryItem?.unitCost?.amount;
      if (amount != null) {
        const cost = parseFloat(amount);
        if (cost > 0) {
          map.set(p.id, cost);
          break;
        }
      }
    }
  }
  return map;
}

export function transformCommerceOrders(
  rawOrders: RawOrder[],
  unitCostByProduct: Map<string, number> = new Map(),
): CommerceOrder[] {
  return rawOrders.map((order) => {
    const revenue = parseFloat(order.totalPriceSet.shopMoney.amount);
    const shipping = parseFloat(order.totalShippingPriceSet?.shopMoney?.amount ?? "0");
    const refunds = parseFloat(order.totalRefundedSet?.shopMoney?.amount ?? "0");

    let discounts = 0;
    let cogs = 0;
    const lines = order.lineItems.edges.map(({ node }) => {
      const original = parseFloat(node.originalTotalSet.shopMoney.amount);
      const discounted = parseFloat(
        node.discountedTotalSet?.shopMoney?.amount ?? node.originalTotalSet.shopMoney.amount,
      );
      discounts += Math.max(0, original - discounted);

      const productId = node.product?.id ?? "";
      const unitCost = productId ? (unitCostByProduct.get(productId) ?? 0) : 0;
      cogs += unitCost * node.quantity;

      return {
        productId,
        title: "",
        quantity: node.quantity,
        revenue: discounted,
        unitCost: unitCost > 0 ? unitCost : undefined,
      };
    });

    const customerEmail = order.customer?.email ?? order.email ?? undefined;
    const customerId = order.customer?.id;

    return {
      id: order.id,
      externalId: order.id,
      platform: "shopify",
      createdAt: order.createdAt,
      revenue,
      cogs: Math.round(cogs * 100) / 100,
      shipping,
      discounts: Math.round(discounts * 100) / 100,
      refunds,
      isNewCustomer: false,
      customerId,
      customerEmail: customerEmail ?? undefined,
      lines,
    };
  });
}

export function computeProfitRollups(
  orders: RawOrder[],
  unitCostByProduct: Map<string, number>,
  productPriceFallback: Map<string, number> = new Map(),
  now = new Date(),
): ProfitOrderRollups {
  const rollups: ProfitOrderRollups = {
    today: emptyBucket(),
    yesterday: emptyBucket(),
    last7d: emptyBucket(),
    last30d: emptyBucket(),
  };

  const nowMs = now.getTime();
  const dayMs = 86400000;

  const addTo = (bucket: ProfitOrderBucket, order: RawOrder, cogs: number) => {
    const revenue = parseFloat(order.totalPriceSet.shopMoney.amount);
    const shipping = parseFloat(order.totalShippingPriceSet?.shopMoney?.amount ?? "0");
    const refunds = parseFloat(order.totalRefundedSet?.shopMoney?.amount ?? "0");
    bucket.revenue += revenue;
    bucket.cogs += cogs;
    bucket.shipping += shipping;
    bucket.refunds += refunds;
    bucket.orders += 1;
  };

  for (const order of orders) {
    const createdMs = new Date(order.createdAt).getTime();
    const ageDays = (nowMs - createdMs) / dayMs;

    let orderCogs = 0;
    for (const { node } of order.lineItems.edges) {
      if (!node.product?.id) continue;
      const qty = node.quantity;
      const unitCost =
        unitCostByProduct.get(node.product.id) ??
        (productPriceFallback.get(node.product.id) ?? 0) * ESTIMATED_COGS_RATE;
      orderCogs += unitCost * qty;
    }
    orderCogs = Math.round(orderCogs * 100) / 100;

    if (ageDays <= 1) addTo(rollups.today, order, orderCogs);
    if (ageDays > 1 && ageDays <= 2) addTo(rollups.yesterday, order, orderCogs);
    if (ageDays <= 7) addTo(rollups.last7d, order, orderCogs);
    if (ageDays <= 30) addTo(rollups.last30d, order, orderCogs);
  }

  for (const key of Object.keys(rollups) as (keyof ProfitOrderRollups)[]) {
    const b = rollups[key];
    b.revenue = Math.round(b.revenue * 100) / 100;
    b.cogs = Math.round(b.cogs * 100) / 100;
    b.shipping = Math.round(b.shipping * 100) / 100;
    b.refunds = Math.round(b.refunds * 100) / 100;
  }

  return rollups;
}

function transformProducts(
  raw: RawProduct[],
  sales: Map<string, { units: number; revenue: number }>,
  unitCostByProduct: Map<string, number>,
): ShopifyProduct[] {
  return raw.map((p) => {
    const variant = p.variants.edges[0]?.node;
    const sale = sales.get(p.id);
    const inventory =
      p.totalInventory ??
      p.variants.edges.reduce((s, e) => s + (e.node.inventoryQuantity ?? 0), 0);
    const shopifyUnitCost = unitCostByProduct.get(p.id);
    const variantItems = p.variants.edges.map((e) => e.node.inventoryItem).filter(Boolean);
    const anyTracked = variantItems.some((item) => item?.tracked === true);
    const allUntracked =
      variantItems.length > 0 && variantItems.every((item) => item?.tracked === false);

    return {
      id: p.id,
      title: p.title,
      imageUrl: p.featuredImage?.url ?? undefined,
      inventoryQuantity: inventory,
      inventoryTracked: allUntracked ? false : anyTracked ? true : undefined,
      unitsSold30d: sale?.units ?? 0,
      revenue30d: sale?.revenue ?? 0,
      price: parseFloat(variant?.price ?? "0"),
      compareAtPrice: variant?.compareAtPrice
        ? parseFloat(variant.compareAtPrice)
        : undefined,
      unitCost: shopifyUnitCost,
      collectionIds: p.collections.edges.map((e) => e.node.id),
      tags: p.tags,
    };
  });
}

function transformCollections(
  raw: RawCollection[],
  products: ShopifyProduct[],
): ShopifyCollection[] {
  return raw.map((c) => {
    const inCollection = products.filter((p) => p.collectionIds.includes(c.id));
    const revenue30d = inCollection.reduce((s, p) => s + p.revenue30d, 0);

    return {
      id: c.id,
      title: c.title,
      productCount: c.productsCount.count,
      homepageFeatured: false,
      revenue30d,
    };
  });
}

function computeStoreMetrics(orders: RawOrder[]) {
  const revenue30d = orders.reduce(
    (s, o) => s + parseFloat(o.totalPriceSet.shopMoney.amount),
    0,
  );
  const orders30d = orders.length;
  const aov30d = orders30d > 0 ? revenue30d / orders30d : 0;

  return {
    revenue30d: Math.round(revenue30d * 100) / 100,
    orders30d,
    aov30d: Math.round(aov30d * 100) / 100,
    conversionRate30d: 0,
  };
}
