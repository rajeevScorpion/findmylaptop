export const AFFILIATE_PLACEMENTS = [
  "product_card",
  "mini_card",
  "comparison",
  "laptop_detail",
  "laptop_alternative",
  "blog_product",
  "chip_recommendation",
  "where_to_buy",
  "deal_page",
] as const;

export type AffiliatePlacement = (typeof AFFILIATE_PLACEMENTS)[number];

export interface AffiliatePriceMetadata {
  amount: number;
  currency: string;
  fetchedAt: string;
  validUntil: string;
}

export interface AffiliateAvailabilityMetadata {
  label: string;
  fetchedAt: string;
  validUntil: string;
}

export interface AffiliateCtaMetadata {
  label: string;
  sourceKey: string;
  sourceName: string;
  priceFreshness: "fresh" | "stale" | "unavailable";
  price: AffiliatePriceMetadata | null;
  availability: AffiliateAvailabilityMetadata | null;
  disclosure: string;
}

export type WithAffiliateCta<T> = T & {
  affiliateCta?: AffiliateCtaMetadata | null;
};

const placementSet = new Set<string>(AFFILIATE_PLACEMENTS);

export function isAffiliatePlacement(value: string): value is AffiliatePlacement {
  return placementSet.has(value);
}

export function buildAffiliateOutboundPath(input: {
  laptopId: string;
  placement: AffiliatePlacement;
  offerId?: string | null;
}): string {
  const params = new URLSearchParams({
    laptop: input.laptopId,
    placement: input.placement,
  });
  if (input.offerId) params.set("offer", input.offerId);
  return `/api/out?${params.toString()}`;
}

export const AFFILIATE_DISCLOSURE =
  "Some links may earn LaptopFinder a commission. Recommendations are based on fit and value first.";
