// Amazon Creators API — OAuth 2.0 + GetItems
// EU region covers amazon.in (IN), amazon.co.uk (GB), amazon.de (DE), etc.

const TOKEN_ENDPOINT = "https://api.amazon.co.uk/auth/o2/token";
const API_BASE = "https://creatorsapi.amazon/catalog/v1/";

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const clientId = process.env.AMAZON_CREATORS_CLIENT_ID;
  const clientSecret = process.env.AMAZON_CREATORS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("AMAZON_CREATORS_CLIENT_ID and AMAZON_CREATORS_CLIENT_SECRET must be set");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials&scope=creatorsapi%3A%3Adefault",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AmazonApiError(res.status, `Token fetch failed: ${text}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.token;
}

export class AmazonApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AmazonApiError";
  }
}

export function extractAsin(url: string): string | null {
  const match = url.match(/\/(?:dp|gp\/product|d)\/([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : null;
}

// Amazon short links (amzn.to, a.co, …) hide the ASIN behind an HTTP redirect,
// so the plain regex can't see it. These hosts are followed once to recover it.
const SHORTENER_HOSTS = new Set(["amzn.to", "a.co", "amzn.eu", "amzn.asia"]);

/**
 * Like `extractAsin`, but if the URL is a known Amazon shortener whose ASIN is
 * only visible after a redirect (e.g. `https://amzn.to/abc123`), follow it once
 * and read the ASIN off the resolved product URL. Returns null if no ASIN can
 * be recovered.
 */
export async function resolveAsin(url: string): Promise<string | null> {
  const direct = extractAsin(url);
  if (direct) return direct;

  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (!SHORTENER_HOSTS.has(host)) return null;

  try {
    const res = await fetch(url, { redirect: "follow" });
    // We only need the final URL, not the page body.
    res.body?.cancel().catch(() => {});
    return extractAsin(res.url);
  } catch {
    return null;
  }
}

export interface AmazonProduct {
  title: string;
  brand?: string;
  price?: string;
  /** Numeric INR price parsed straight from the API (authoritative for price_approx). */
  priceAmount?: number;
  availability?: string;
  imageUrl?: string;
  features: string[];
  asin: string;
}

/**
 * OffersV2 nests the price under `price.money` (`{ amount, displayAmount }`);
 * older/flatter shapes put `displayAmount` directly on `price`. Read both so a
 * structure change on Amazon's side doesn't silently drop the price again.
 */
function extractListingPrice(listing: unknown): { display?: string; amount?: number } {
  const price = (listing as { price?: Record<string, unknown> } | null)?.price;
  if (!price) return {};
  const money = (price.money as Record<string, unknown> | undefined) ?? price;
  const display = (money.displayAmount ?? price.displayAmount ?? price.displayString) as
    | string
    | undefined;
  // Prefer the human-readable display ("₹66,500.00") — it's authoritative in
  // rupees. Amazon's `money.amount` on amazon.in is in paise (minor units), so
  // it's only a fallback and must be divided by 100.
  const amount =
    parsePriceToInt(display) ??
    (typeof money.amount === "number" ? Math.round(money.amount / 100) : null);
  return { display, amount: amount ?? undefined };
}

/**
 * Parses a display price like "₹89,990" or "₹66,500.00" → 89990 / 66500.
 * The decimal portion is dropped first so the ".00" doesn't get folded into the
 * integer (which would yield paise, e.g. 6650000). Returns null if unparseable.
 */
export function parsePriceToInt(displayAmount?: string): number | null {
  if (!displayAmount) return null;
  // Indian formatting groups with commas, so any "." is a decimal separator.
  const intPart = displayAmount.split(".")[0];
  const digits = intPart.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return isNaN(n) ? null : n;
}

export async function fetchProductByAsin(asin: string): Promise<AmazonProduct> {
  const partnerTag = process.env.AMAZON_PARTNER_TAG;
  const marketplace = process.env.AMAZON_MARKETPLACE ?? "www.amazon.in";

  if (!partnerTag) throw new Error("AMAZON_PARTNER_TAG must be set");

  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}getItems`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
      "x-marketplace": marketplace,
    },
    body: JSON.stringify({
      itemIds: [asin],
      partnerTag,
      marketplace,
      resources: [
        "itemInfo.title",
        "itemInfo.features",
        "itemInfo.byLineInfo",
        "itemInfo.technicalInfo",
        "offersV2.listings.price",
        "offersV2.listings.availability",
        "images.primary.large",
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AmazonApiError(res.status, `GetItems failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // Try multiple known response shapes — log raw so we can debug if neither matches
  const item =
    data?.itemsResult?.items?.[0] ??
    data?.items?.[0] ??
    data?.data?.items?.[0] ??
    null;

  if (!item) {
    // Expose the raw response so we can see the actual structure
    throw new AmazonApiError(
      404,
      `No product found for ASIN ${asin}. Raw response: ${JSON.stringify(data)}`
    );
  }

  const listing = item?.offersV2?.listings?.[0];
  const { display: priceDisplay, amount: priceAmount } = extractListingPrice(listing);
  if (!priceDisplay) {
    // Price is the one field the AI can't infer — log the raw shape so we can
    // chase it if Amazon nests it somewhere new instead of silently blanking it.
    console.warn(
      `[amazon] No price parsed for ASIN ${asin}. Raw offersV2:`,
      JSON.stringify(item?.offersV2 ?? null)
    );
  }
  return {
    asin,
    title: item?.itemInfo?.title?.displayValue ?? "",
    brand: item?.itemInfo?.byLineInfo?.brand?.displayValue,
    price: priceDisplay,
    priceAmount,
    availability: listing?.availability?.message ?? listing?.availability?.type,
    imageUrl: item?.images?.primary?.large?.url,
    features: [
      ...(item?.itemInfo?.features?.displayValues ?? []),
      ...(item?.itemInfo?.technicalInfo?.formats?.displayValues ?? []),
    ],
  };
}

export function buildAffiliateUrl(asin: string): string {
  const tag = process.env.AMAZON_PARTNER_TAG ?? "";
  const marketplace = process.env.AMAZON_MARKETPLACE ?? "www.amazon.in";
  return `https://${marketplace}/dp/${asin}?tag=${tag}`;
}

export function productToText(product: AmazonProduct): string {
  const lines: string[] = [];
  lines.push(`Product: ${product.title}`);
  if (product.brand) lines.push(`Brand: ${product.brand}`);
  if (product.price) lines.push(`Price: ${product.price}`);
  if (product.features.length > 0) {
    lines.push("\nKey Features:");
    product.features.forEach((f) => lines.push(`• ${f}`));
  }
  return lines.join("\n");
}
