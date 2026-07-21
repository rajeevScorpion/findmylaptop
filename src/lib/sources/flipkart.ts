import "server-only";

import { AgentError } from "@/lib/growth-agents/errors";
import { sourceProductSchema, type SourceAdapter } from "./types";

const FLIPKART_API_BASE = "https://affiliate-api.flipkart.net/affiliate";
const PRODUCT_ID_PATTERN = /^[A-Z0-9]{8,64}$/;
const REQUEST_TIMEOUT_MS = 10_000;

interface FlipkartCredentials {
  affiliateId: string;
  token: string;
}

function credentials(): FlipkartCredentials | null {
  const affiliateId = process.env.FLIPKART_AFFILIATE_ID?.trim();
  const token = process.env.FLIPKART_AFFILIATE_TOKEN?.trim();
  return affiliateId && token ? { affiliateId, token } : null;
}

function affiliateHeaders(value: FlipkartCredentials): HeadersInit {
  return {
    Accept: "application/json",
    "Fk-Affiliate-Id": value.affiliateId,
    "Fk-Affiliate-Token": value.token,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function money(value: unknown): { amount: number; currency: string } | undefined {
  const record = asRecord(value);
  const rawAmount = record?.amount ?? record?.value ?? value;
  const amount =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string"
        ? Number(rawAmount.replace(/[^\d.]/g, ""))
        : Number.NaN;
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  const currency = text(record?.currency)?.toUpperCase() ?? "INR";
  return /^[A-Z]{3}$/.test(currency) ? { amount, currency } : undefined;
}

function firstImage(value: unknown): string | undefined {
  if (typeof value === "string") return text(value);
  const record = asRecord(value);
  if (!record) return undefined;
  const preferred = ["800x800", "400x400", "200x200", "unknown", "original"];
  for (const key of preferred) {
    const image = text(record[key]);
    if (image) return image;
  }
  return Object.values(record).map(text).find(Boolean);
}

function mapFlipkartProduct(payload: unknown, requestedId: string) {
  const root = asRecord(payload);
  const base =
    asRecord(root?.productBaseInfoV1) ??
    asRecord(root?.productBaseInfo) ??
    root;
  if (!base) {
    throw new AgentError({
      code: "SOURCE_UNAVAILABLE",
      message: "Flipkart returned an unsupported product response.",
    });
  }

  const identifier = asRecord(base.productIdentifier);
  const productId =
    text(base.productId)?.toUpperCase() ??
    text(identifier?.productId)?.toUpperCase() ??
    requestedId;
  const title = text(base.title);
  const productUrl = text(base.productUrl);
  if (!title || !productUrl) {
    throw new AgentError({
      code: "SOURCE_UNAVAILABLE",
      message: "Flipkart did not return the required title and product URL.",
      details: { productId },
    });
  }

  const fetchedAt = new Date().toISOString();
  const price =
    money(base.flipkartSpecialPrice) ??
    money(base.flipkartSellingPrice) ??
    money(base.sellingPrice) ??
    money(base.price);
  const inStock =
    typeof base.inStock === "boolean"
      ? base.inStock
      : typeof base.isAvailable === "boolean"
        ? base.isAvailable
        : undefined;
  const description = text(base.productDescription ?? base.description);

  return sourceProductSchema.parse({
    sourceKey: "flipkart",
    sourceProductId: productId,
    title,
    url: productUrl,
    affiliateUrl: productUrl,
    brand: text(base.productBrand ?? base.brand),
    price,
    priceFetchedAt: price ? fetchedAt : undefined,
    availability: inStock === undefined ? undefined : inStock ? "In stock" : "Out of stock",
    imageUrl: firstImage(base.imageUrls ?? base.imageUrl),
    fetchedAt,
    features: description ? [description] : undefined,
    // Retain only the reviewed catalog subset, never credentials or headers.
    rawPayload: {
      productId,
      title,
      productUrl,
      productBrand: text(base.productBrand ?? base.brand),
      inStock,
      description,
    },
  });
}

function sourceRequestError(status: number): AgentError {
  if (status === 401 || status === 403) {
    return new AgentError({
      code: "SOURCE_AUTH_ERROR",
      message: "Flipkart Affiliate API rejected the configured credentials.",
      retryable: false,
      details: { status },
    });
  }
  if (status === 429) {
    return new AgentError({
      code: "SOURCE_RATE_LIMITED",
      message: "Flipkart Affiliate API rate limit was reached.",
      retryable: true,
      details: { status },
    });
  }
  return new AgentError({
    code: "SOURCE_UNAVAILABLE",
    message: "Flipkart Affiliate API is unavailable for this request.",
    retryable: status >= 500,
    details: { status },
  });
}

export const flipkartSourceAdapter: SourceAdapter = {
  key: "flipkart",
  displayName: "Flipkart",
  mode: "api",
  capabilities: {
    productId: true,
    productUrl: false,
    manualPayload: false,
    livePrice: true,
  },

  async getHealth(options = {}) {
    const enabled = process.env.FLIPKART_AFFILIATE_ENABLED === "true";
    const configuredCredentials = credentials();
    const configured = configuredCredentials !== null;
    const checkedAt = new Date().toISOString();
    if (!enabled || !configuredCredentials || !options.probe) {
      return {
        sourceKey: this.key,
        displayName: this.displayName,
        mode: this.mode,
        enabled,
        configured,
        status: !enabled ? "disabled" : configured ? "ready" : "unconfigured",
        message: !enabled
          ? "Disabled by default. Set the server-side enable flag only after affiliate access is confirmed."
          : configured
            ? "Affiliate headers are configured. Remote API was not probed."
            : "Flipkart affiliate ID and token are not configured.",
        checkedAt,
        capabilities: this.capabilities,
        remoteChecked: false,
        credentialStatus: configured ? "unchecked" : "not_configured",
      };
    }

    try {
      const url = `${FLIPKART_API_BASE}/download/feeds/${encodeURIComponent(
        configuredCredentials.affiliateId
      )}.json`;
      const response = await fetchWithTimeout(url, {
        headers: affiliateHeaders(configuredCredentials),
      });
      response.body?.cancel().catch(() => undefined);
      return {
        sourceKey: this.key,
        displayName: this.displayName,
        mode: this.mode,
        enabled: true,
        configured: true,
        status: response.ok ? "ready" : response.status === 429 ? "degraded" : "unavailable",
        message: response.ok
          ? "Official Affiliate API accepted the configured headers."
          : response.status === 401 || response.status === 403
            ? "Official Affiliate API rejected the configured credentials."
            : `Official Affiliate API health request returned HTTP ${response.status}.`,
        checkedAt,
        capabilities: this.capabilities,
        remoteChecked: true,
        credentialStatus: response.ok
          ? "valid"
          : response.status === 401 || response.status === 403
            ? "invalid"
            : "error",
      };
    } catch {
      return {
        sourceKey: this.key,
        displayName: this.displayName,
        mode: this.mode,
        enabled: true,
        configured: true,
        status: "unavailable",
        message: "Official Affiliate API health request timed out or failed.",
        checkedAt,
        capabilities: this.capabilities,
        remoteChecked: true,
        credentialStatus: "error",
      };
    }
  },

  async fetchProduct(request) {
    const configuredCredentials = credentials();
    if (process.env.FLIPKART_AFFILIATE_ENABLED !== "true") {
      throw new AgentError({
        code: "CONFIGURATION_ERROR",
        message: "Flipkart source is disabled.",
      });
    }
    if (!configuredCredentials) {
      throw new AgentError({
        code: "CONFIGURATION_ERROR",
        message: "Flipkart Affiliate API is not configured.",
      });
    }

    const productId = request.productId?.trim().toUpperCase();
    if (!productId || !PRODUCT_ID_PATTERN.test(productId)) {
      throw new AgentError({
        code: "VALIDATION_ERROR",
        message: "Flipkart requires a valid direct product ID; arbitrary URLs are not fetched.",
      });
    }

    const url = `${FLIPKART_API_BASE}/1.0/product.json?id=${encodeURIComponent(productId)}`;
    let response: Response;
    try {
      response = await fetchWithTimeout(url, {
        headers: affiliateHeaders(configuredCredentials),
      });
    } catch (error) {
      throw new AgentError({
        code: "SOURCE_UNAVAILABLE",
        message: "Flipkart Affiliate API request timed out or failed.",
        retryable: true,
        cause: error,
      });
    }
    if (!response.ok) throw sourceRequestError(response.status);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new AgentError({
        code: "SOURCE_UNAVAILABLE",
        message: "Flipkart Affiliate API returned invalid JSON.",
        retryable: true,
        cause: error,
      });
    }
    return mapFlipkartProduct(payload, productId);
  },
};

export { affiliateHeaders, mapFlipkartProduct, PRODUCT_ID_PATTERN };
