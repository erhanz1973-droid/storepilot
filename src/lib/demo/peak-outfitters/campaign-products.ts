import type { CampaignProductLink } from "@/lib/attribution/product-types";

const GID = (id: string) => `gid://shopify/Product/${id}`;
const COL = (id: string) => `gid://shopify/Collection/${id}`;

/** Explicit campaign → product links for Peak Outfitters demo store */
export const PEAK_OUTFITTERS_CAMPAIGN_PRODUCTS: CampaignProductLink[] = [
  {
    campaignId: "po-meta-summer-hiking",
    productIds: [GID("po-1001"), GID("po-1003"), GID("po-1002")],
    collectionIds: [COL("po-backpacks"), COL("po-tents")],
    method: "campaign_attribution",
    confidencePct: 88,
  },
  {
    campaignId: "po-meta-retarget-cart",
    productIds: [
      GID("po-1001"),
      GID("po-1005"),
      GID("po-1002"),
      GID("po-1006"),
    ],
    method: "campaign_attribution",
    confidencePct: 86,
  },
  {
    campaignId: "po-meta-brand-trail",
    productIds: [GID("po-1008"), GID("po-1016"), GID("po-1017"), GID("po-1006")],
    collectionIds: [COL("po-accessories")],
    method: "campaign_attribution",
    confidencePct: 84,
  },
  {
    campaignId: "po-meta-spring-collection",
    productIds: [GID("po-1010"), GID("po-1018"), GID("po-1021")],
    method: "campaign_attribution",
    confidencePct: 82,
  },
  {
    campaignId: "po-meta-prospecting-broad",
    productIds: [
      GID("po-1021"),
      GID("po-1022"),
      GID("po-1027"),
      GID("po-1028"),
    ],
    method: "revenue_allocation",
    confidencePct: 65,
  },
  {
    campaignId: "po-meta-ig-stories",
    productIds: [GID("po-1006"), GID("po-1014"), GID("po-1005")],
    method: "campaign_attribution",
    confidencePct: 78,
  },
  {
    campaignId: "po-meta-lal-purchasers",
    productIds: [GID("po-1001"), GID("po-1003"), GID("po-1004")],
    method: "direct_purchase",
    confidencePct: 92,
  },
  {
    campaignId: "po-meta-video-test",
    productIds: [GID("po-1021"), GID("po-1023")],
    method: "campaign_attribution",
    confidencePct: 80,
  },
];
