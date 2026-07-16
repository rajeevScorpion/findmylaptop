import "server-only";

const ASIN_PATTERN = /^[A-Z0-9]{10}$/;

const AMAZON_HOSTS = ["amazon.in", "amzn.to", "a.co", "amzn.asia"] as const;
const FLIPKART_HOSTS = ["flipkart.com", "dl.flipkart.com"] as const;
const MANUAL_CANONICAL_HOSTS = [
  ...AMAZON_HOSTS,
  ...FLIPKART_HOSTS,
  "croma.com",
  "reliancedigital.in",
  "vijaysales.com",
  "lenovo.com",
  "hp.com",
  "dell.com",
  "asus.com",
  "acer.com",
  "apple.com",
] as const;

const REDIRECT_PARAMETERS = new Set([
  "continue",
  "dest",
  "destination",
  "next",
  "out",
  "redirect",
  "redirect_uri",
  "redirect_url",
  "return",
  "return_to",
  "return_url",
  "target",
  "to",
  "url",
  "uri",
]);

export interface SourceLinkPolicy {
  sourceKey: "amazon" | "flipkart" | "manual";
  displayName: string;
  allowedHosts: readonly string[];
  maxPriceFreshnessMinutes: number;
  supportsAffiliateGeneration: boolean;
}

const SOURCE_POLICIES: Record<SourceLinkPolicy["sourceKey"], SourceLinkPolicy> = {
  amazon: {
    sourceKey: "amazon",
    displayName: "Amazon India",
    allowedHosts: AMAZON_HOSTS,
    maxPriceFreshnessMinutes: 60,
    supportsAffiliateGeneration: true,
  },
  flipkart: {
    sourceKey: "flipkart",
    displayName: "Flipkart",
    allowedHosts: FLIPKART_HOSTS,
    maxPriceFreshnessMinutes: 1_440,
    supportsAffiliateGeneration: true,
  },
  manual: {
    sourceKey: "manual",
    displayName: "Approved retailer",
    allowedHosts: MANUAL_CANONICAL_HOSTS,
    maxPriceFreshnessMinutes: 1_440,
    supportsAffiliateGeneration: false,
  },
};

export function getSourceLinkPolicy(sourceKey: string): SourceLinkPolicy | null {
  return SOURCE_POLICIES[sourceKey as SourceLinkPolicy["sourceKey"]] ?? null;
}

function hostMatches(hostname: string, allowed: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return allowed.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function hasRedirectVector(url: URL): boolean {
  if (/\/(?:away|external|out|redirect)(?:\/|$)/i.test(url.pathname)) {
    return true;
  }
  return [...url.searchParams.keys()].some((key) =>
    REDIRECT_PARAMETERS.has(key.toLowerCase())
  );
}

export function parseAllowedSourceUrl(sourceKey: string, value: string): URL | null {
  const policy = getSourceLinkPolicy(sourceKey);
  if (!policy) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (url.port && url.port !== "443" && url.port !== "80") return null;
    if (!hostMatches(url.hostname, policy.allowedHosts)) return null;
    url.protocol = "https:";
    url.port = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function extractAmazonAsin(
  sourceProductId?: string | null,
  ...urls: Array<string | null | undefined>
): string | null {
  const productId = sourceProductId?.trim().toUpperCase();
  if (productId && ASIN_PATTERN.test(productId)) return productId;
  for (const value of urls) {
    if (!value) continue;
    const url = parseAllowedSourceUrl("amazon", value);
    if (!url) continue;
    const match = url.pathname.match(/\/(?:dp|gp\/product|d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

function canonicalizeFlipkartUrl(parsed: URL): string | null {
  if (hasRedirectVector(parsed)) return null;
  const canonical = new URL(parsed.toString());
  if (canonical.hostname.toLowerCase().replace(/^www\./, "") === "dl.flipkart.com") {
    canonical.pathname = canonical.pathname.replace(/^\/dl(?=\/)/i, "");
  }
  if (!/\/p\/[A-Za-z0-9]+(?:\/|$)/i.test(canonical.pathname)) return null;
  const pid = canonical.searchParams.get("pid");
  canonical.hostname = "www.flipkart.com";
  canonical.search = "";
  if (pid && /^[A-Za-z0-9]{5,64}$/.test(pid)) {
    canonical.searchParams.set("pid", pid);
  }
  return canonical.toString();
}

export function canonicalizeSourceUrl(input: {
  sourceKey: string;
  value: string;
  sourceProductId?: string | null;
}): string | null {
  const parsed = parseAllowedSourceUrl(input.sourceKey, input.value);
  if (!parsed) return null;

  if (input.sourceKey === "amazon") {
    const asin = extractAmazonAsin(input.sourceProductId, parsed.toString());
    return asin ? `https://www.amazon.in/dp/${asin}` : null;
  }

  if (input.sourceKey === "manual") {
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (AMAZON_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
      const asin = extractAmazonAsin(input.sourceProductId, parsed.toString());
      return asin ? `https://www.amazon.in/dp/${asin}` : null;
    }
    if (FLIPKART_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
      return canonicalizeFlipkartUrl(parsed);
    }
    if (hasRedirectVector(parsed)) return null;
    // Other approved retailers do not have a documented functional-query
    // allowlist. Dropping the entire query is the only strict way to guarantee
    // that a "canonical" fallback does not retain unknown affiliate tracking.
    parsed.search = "";
    return parsed.toString();
  }

  if (input.sourceKey === "flipkart") return canonicalizeFlipkartUrl(parsed);
  return null;
}

export function generateAffiliateUrl(input: {
  sourceKey: string;
  canonicalUrl: string;
  sourceProductId?: string | null;
}): string | null {
  const canonical = parseAllowedSourceUrl(input.sourceKey, input.canonicalUrl);
  if (!canonical) return null;

  if (input.sourceKey === "amazon") {
    const partnerTag = process.env.AMAZON_PARTNER_TAG?.trim();
    const asin = extractAmazonAsin(
      input.sourceProductId,
      input.canonicalUrl
    );
    if (!partnerTag || !asin) return null;
    const affiliate = new URL(`https://www.amazon.in/dp/${asin}`);
    affiliate.searchParams.set("tag", partnerTag);
    return parseAllowedSourceUrl("amazon", affiliate.toString())?.toString() ?? null;
  }

  if (input.sourceKey === "flipkart") {
    const affiliateId = process.env.FLIPKART_AFFILIATE_ID?.trim();
    if (!affiliateId) return null;
    const affiliate = new URL(canonical.toString());
    affiliate.searchParams.set("affid", affiliateId);
    return parseAllowedSourceUrl("flipkart", affiliate.toString())?.toString() ?? null;
  }

  return null;
}
