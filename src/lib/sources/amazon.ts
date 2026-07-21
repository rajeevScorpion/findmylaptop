import "server-only";

import {
  AmazonApiError,
  buildAffiliateUrl,
  fetchProductByAsin,
  resolveAsin,
  validateAmazonCreatorsCredentials,
} from "@/lib/amazon-creators";
import { AgentError } from "@/lib/growth-agents/errors";
import { sourceProductSchema, type SourceAdapter } from "./types";

const ASIN_PATTERN = /^[A-Z0-9]{10}$/;
const AMAZON_HOSTS = new Set([
  "amazon.in",
  "amazon.com",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amzn.to",
  "a.co",
  "amzn.eu",
  "amzn.asia",
]);

function isAmazonUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return [...AMAZON_HOSTS].some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

async function asinFromRequest(request: {
  productId?: string;
  url?: string;
}): Promise<string> {
  if (request.productId) {
    const asin = request.productId.trim().toUpperCase();
    if (!ASIN_PATTERN.test(asin)) {
      throw new TypeError("Amazon productId must be a 10-character ASIN");
    }
    return asin;
  }

  if (!request.url || !isAmazonUrl(request.url)) {
    throw new TypeError("Provide an Amazon product URL or ASIN");
  }
  const asin = await resolveAsin(request.url);
  if (!asin || !ASIN_PATTERN.test(asin)) {
    throw new TypeError("Could not resolve an ASIN from the Amazon URL");
  }
  return asin;
}

export const amazonSourceAdapter: SourceAdapter = {
  key: "amazon",
  displayName: "Amazon India",
  mode: "api",
  capabilities: {
    productId: true,
    productUrl: true,
    manualPayload: false,
    livePrice: true,
  },

  async getHealth(options = {}) {
    const enabled = process.env.AMAZON_CREATORS_ENABLED !== "false";
    const missing = [
      "AMAZON_CREATORS_CLIENT_ID",
      "AMAZON_CREATORS_CLIENT_SECRET",
      "AMAZON_PARTNER_TAG",
    ].filter((key) => !process.env[key]?.trim());
    const configured = missing.length === 0;
    const checkedAt = new Date().toISOString();
    if (!enabled || !configured || !options.probe) {
      return {
        sourceKey: this.key,
        displayName: this.displayName,
        mode: this.mode,
        enabled,
        configured,
        status: !enabled ? "disabled" : configured ? "ready" : "unconfigured",
        message: !enabled
          ? "Disabled by server configuration."
          : configured
            ? "Creators API credentials and partner tag are configured. Remote authentication has not been checked."
            : `Missing server configuration: ${missing.join(", ")}.`,
        checkedAt,
        capabilities: this.capabilities,
        remoteChecked: false,
        credentialStatus: configured ? "unchecked" : "not_configured",
      };
    }

    try {
      await validateAmazonCreatorsCredentials();
      return {
        sourceKey: this.key,
        displayName: this.displayName,
        mode: this.mode,
        enabled: true,
        configured: true,
        status: "ready" as const,
        message:
          "Amazon accepted the configured Creators API client credentials. The partner tag is configured.",
        checkedAt,
        capabilities: this.capabilities,
        remoteChecked: true,
        credentialStatus: "valid" as const,
      };
    } catch (error) {
      const authenticationRejected =
        error instanceof AmazonApiError &&
        (error.status === 400 || error.status === 401 || error.status === 403);
      const rateLimited = error instanceof AmazonApiError && error.status === 429;
      return {
        sourceKey: this.key,
        displayName: this.displayName,
        mode: this.mode,
        enabled: true,
        configured: true,
        status: rateLimited ? "degraded" as const : "unavailable" as const,
        message: authenticationRejected
          ? "Amazon rejected the configured Creators API client credentials."
          : rateLimited
            ? "Amazon temporarily rate-limited the credential validation request."
            : "Amazon credential validation timed out or the service was unavailable.",
        checkedAt,
        capabilities: this.capabilities,
        remoteChecked: true,
        credentialStatus: authenticationRejected ? "invalid" as const : "error" as const,
      };
    }
  },

  async fetchProduct(request) {
    const health = await this.getHealth();
    if (!health.enabled) {
      throw new AgentError({
        code: "CONFIGURATION_ERROR",
        message: "Amazon source is disabled.",
      });
    }
    if (!health.configured) {
      throw new AgentError({
        code: "CONFIGURATION_ERROR",
        message: "Amazon Creators API is not configured.",
        details: { missingConfiguration: true },
      });
    }

    const asin = await asinFromRequest(request);
    try {
      const product = await fetchProductByAsin(asin);
      const fetchedAt = new Date().toISOString();
      const affiliateUrl = buildAffiliateUrl(asin);
      const productUrl = new URL(affiliateUrl);
      productUrl.search = "";

      return sourceProductSchema.parse({
        sourceKey: this.key,
        sourceProductId: asin,
        title: product.title,
        url: productUrl.toString(),
        affiliateUrl,
        brand: product.brand,
        price:
          product.priceAmount === undefined
            ? undefined
            : { amount: product.priceAmount, currency: "INR" },
        priceFetchedAt: product.priceAmount === undefined ? undefined : fetchedAt,
        availability: product.availability,
        imageUrl: product.imageUrl,
        fetchedAt,
        features: product.features,
        rawPayload: {
          asin,
          title: product.title,
          brand: product.brand,
          availability: product.availability,
          features: product.features,
        },
      });
    } catch (error) {
      if (error instanceof AmazonApiError) {
        if (error.status === 401 || error.status === 403) {
          throw new AgentError({
            code: "SOURCE_AUTH_ERROR",
            message: "Amazon Creators API rejected the configured credentials or account access.",
            retryable: false,
            cause: error,
          });
        }
        if (error.status === 429) {
          throw new AgentError({
            code: "SOURCE_RATE_LIMITED",
            message: "Amazon Creators API rate limit was reached.",
            retryable: true,
            cause: error,
          });
        }
        throw new AgentError({
          code: "SOURCE_UNAVAILABLE",
          message: "Amazon Creators API could not return this product.",
          retryable: error.status >= 500,
          details: { status: error.status },
          cause: error,
        });
      }
      throw error;
    }
  },
};

export { asinFromRequest, isAmazonUrl };
