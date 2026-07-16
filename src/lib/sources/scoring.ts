import type {
  ComplianceStatus,
  NormalizedLaptop,
  PriceFreshness,
} from "./types";

type AssessableProduct = Omit<
  NormalizedLaptop,
  | "fitTags"
  | "riskTags"
  | "confidenceScore"
  | "fitScore"
  | "complianceStatus"
>;

export interface CandidateAssessment {
  confidenceScore: number;
  fitScore: number;
  fitTags: string[];
  riskTags: string[];
  complianceStatus: ComplianceStatus;
}

const CORE_FIELDS: (keyof AssessableProduct)[] = [
  "brand",
  "model",
  "cpu",
  "gpu",
  "ramGb",
  "storageGb",
  "display",
  "weightKg",
  "operatingSystem",
  "warranty",
];

const AMAZON_PRODUCT_HOSTS = [
  "amazon.in",
  "amazon.com",
  "amazon.co.uk",
  "amzn.to",
  "a.co",
  "amzn.eu",
  "amzn.asia",
];

const FLIPKART_PRODUCT_HOSTS = ["flipkart.com", "dl.flipkart.com"];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function hostnameMatches(urlValue: string, allowedHosts: string[]): boolean {
  try {
    const hostname = new URL(urlValue).hostname.toLowerCase().replace(/^www\./, "");
    return allowedHosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

function assessCompliance(
  product: AssessableProduct,
  riskTags: Set<string>
): ComplianceStatus {
  if (!isHttpUrl(product.url)) {
    riskTags.add("invalid-product-url");
    return "blocked";
  }

  if (product.affiliateUrl && !isHttpUrl(product.affiliateUrl)) {
    riskTags.add("invalid-affiliate-url");
    return "blocked";
  }

  let status: ComplianceStatus = "safe";
  const source = product.sourceKey;

  if (
    source === "amazon" &&
    !hostnameMatches(product.url, AMAZON_PRODUCT_HOSTS)
  ) {
    riskTags.add("source-url-mismatch");
    status = "blocked";
  }
  if (
    source === "flipkart" &&
    !hostnameMatches(product.url, FLIPKART_PRODUCT_HOSTS)
  ) {
    riskTags.add("source-url-mismatch");
    status = "blocked";
  }

  if (
    product.affiliateUrl &&
    source === "amazon" &&
    !hostnameMatches(product.affiliateUrl, AMAZON_PRODUCT_HOSTS)
  ) {
    riskTags.add("affiliate-url-mismatch");
    status = "blocked";
  }
  if (
    product.affiliateUrl &&
    source === "flipkart" &&
    !hostnameMatches(product.affiliateUrl, FLIPKART_PRODUCT_HOSTS)
  ) {
    riskTags.add("affiliate-url-mismatch");
    status = "blocked";
  }

  if (product.price) {
    if (!product.priceFetchedAt || product.priceFreshness === "unknown") {
      riskTags.add("unverified-price-timestamp");
      if (status !== "blocked") status = "needs_review";
    } else if (product.priceFreshness === "stale") {
      riskTags.add("stale-price");
      if (status !== "blocked") status = "needs_review";
    }
  }

  if (source !== "amazon" && source !== "flipkart" && source !== "manual") {
    riskTags.add("unverified-source-policy");
    if (status !== "blocked") status = "needs_review";
  }

  return status;
}

/**
 * Deterministic, evidence-only candidate assessment. It rewards observed fields
 * and conservative hardware adequacy; it never fills in a missing spec.
 */
export function assessCandidate(product: AssessableProduct): CandidateAssessment {
  const fitTags = new Set<string>();
  const riskTags = new Set<string>();

  const observedCoreFields = CORE_FIELDS.filter(
    (field) => product[field] !== undefined && product[field] !== null
  ).length;

  let confidence = 20 + observedCoreFields * 6;
  if (product.sourceProductId) confidence += 8;
  if (product.brand && product.model) confidence += 6;
  if (product.price && product.priceFetchedAt) confidence += 5;
  if (product.affiliateUrl) confidence += 3;
  if (product.sourceKey === "amazon" || product.sourceKey === "flipkart") confidence += 4;

  let fit = 35;

  if (product.ramGb !== undefined) {
    if (product.ramGb >= 32) {
      fit += 14;
      fitTags.add("heavy-workload");
    } else if (product.ramGb >= 16) {
      fit += 11;
      fitTags.add("general-student");
    } else if (product.ramGb >= 8) {
      fit += 2;
      riskTags.add("low-ram");
    } else {
      fit -= 12;
      riskTags.add("low-ram");
    }
  } else {
    riskTags.add("unknown-ram");
  }

  if (product.ramUpgradeable === true) fitTags.add("upgrade-friendly");
  if (product.ramUpgradeable === false && (product.ramGb ?? 0) < 16) {
    riskTags.add("non-upgradeable-ram");
  }

  if (product.storageGb !== undefined) {
    if (product.storageGb >= 1_000) fit += 10;
    else if (product.storageGb >= 512) fit += 7;
    else if (product.storageGb < 512) {
      fit -= 3;
      riskTags.add("small-ssd");
    }
  } else {
    riskTags.add("unknown-storage");
  }

  if (product.storageUpgradeable === true) fitTags.add("upgrade-friendly");

  if (product.gpu?.dedicated === true || (product.gpu?.vramGb ?? 0) > 0) {
    fit += 10;
    fitTags.add("creative-gpu");
    if ((product.gpu?.vramGb ?? 0) >= 6) {
      fitTags.add("animation");
      fitTags.add("video-editing");
    }
  } else if (product.gpu?.dedicated === false) {
    riskTags.add("integrated-graphics-only");
  } else if (!product.gpu) {
    riskTags.add("unknown-gpu");
  }

  if (product.cpu) fit += 7;
  else riskTags.add("unknown-cpu");

  if (product.display?.colorGamut) {
    fit += 6;
    fitTags.add("graphic-design");
  }
  if ((product.display?.refreshRateHz ?? 0) >= 120) fitTags.add("gaming");

  if (product.weightKg !== undefined) {
    if (product.weightKg <= 1.7) {
      fit += 5;
      fitTags.add("portable");
    } else if (product.weightKg >= 2.5) {
      fit -= 4;
      riskTags.add("heavy-laptop");
    }
  }

  if (product.price?.currency === "INR" && product.price.amount <= 75_000) {
    fitTags.add("budget-value");
  }

  if (observedCoreFields < 4) riskTags.add("insufficient-source-data");
  const complianceStatus = assessCompliance(product, riskTags);
  if (complianceStatus !== "safe") riskTags.add("needs-admin-review");

  if (riskTags.has("insufficient-source-data")) confidence -= 12;
  if (product.priceFreshness === "stale") confidence -= 8;
  if (complianceStatus === "blocked") confidence -= 20;

  return {
    confidenceScore: clampScore(confidence),
    fitScore: clampScore(fit),
    fitTags: [...fitTags].sort(),
    riskTags: [...riskTags].sort(),
    complianceStatus,
  };
}

export function isPriceDisplayable(
  freshness: PriceFreshness,
  complianceStatus: ComplianceStatus
): boolean {
  return freshness === "fresh" && complianceStatus === "safe";
}
