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

const SHORT_SOURCE_NAMES: Record<string, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
};

/** Short retailer name for buttons and badges ("Amazon India" -> "Amazon"). */
export function shortSourceName(sourceKey: string): string {
  return SHORT_SOURCE_NAMES[sourceKey] ?? "retailer";
}

/** Outbound button text. Names the destination so the click is predictable. */
export function affiliateCtaLabel(sourceKey: string): string {
  const name = SHORT_SOURCE_NAMES[sourceKey];
  return name ? `See on ${name}` : "See offer";
}

export function formatInrPrice(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-IN")}`;
  }
}

/**
 * Headline price for a catalog card. Prefers the numeric column so formatting
 * stays consistent across cards, then falls back to the stored label, which
 * retailers hand back pre-formatted (and sometimes with a trailing ".00").
 *
 * This is the price maintained by Refresh Prices on the laptop row itself, so
 * it is present for manually added products that have no `product_offers` row.
 * Time-sensitive offer pricing stays in AffiliateCtaDetails, which gates on
 * freshness.
 */
export function catalogDisplayPrice(laptop: {
  price_approx?: number | null;
  price_label?: string | null;
}): string | null {
  if (typeof laptop.price_approx === "number" && laptop.price_approx > 0) {
    return formatInrPrice(laptop.price_approx);
  }
  const label = laptop.price_label?.trim();
  return label || null;
}
