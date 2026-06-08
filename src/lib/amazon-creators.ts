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

export interface AmazonProduct {
  title: string;
  brand?: string;
  price?: string;
  availability?: string;
  imageUrl?: string;
  features: string[];
  asin: string;
}

/** Parses a display price like "₹89,990" → 89990. Returns null if unparseable. */
export function parsePriceToInt(displayAmount?: string): number | null {
  if (!displayAmount) return null;
  const digits = displayAmount.replace(/[^\d]/g, "");
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
        "offersV2.listings.availability.message",
        "offersV2.listings.availability.type",
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
  return {
    asin,
    title: item?.itemInfo?.title?.displayValue ?? "",
    brand: item?.itemInfo?.byLineInfo?.brand?.displayValue,
    price: listing?.price?.displayAmount,
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
