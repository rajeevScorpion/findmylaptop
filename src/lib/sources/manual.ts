import { sourceProductSchema, type SourceAdapter, type SourceProduct } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Manual import payload must be a JSON object");
  }
  return value as Record<string, unknown>;
}

function firstDefined(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return undefined;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value
    .map(optionalString)
    .filter((entry): entry is string => Boolean(entry));
  return strings.length > 0 ? strings : undefined;
}

function manualPayloadToSourceProduct(payload: unknown): SourceProduct {
  const raw = asRecord(payload);
  const now = new Date().toISOString();
  const rawPrice = firstDefined(raw, ["price", "price_amount", "priceAmount"]);
  const rawCurrency = firstDefined(raw, ["priceCurrency", "price_currency", "currency"]);
  const price =
    rawPrice === undefined
      ? undefined
      : typeof rawPrice === "object" && rawPrice !== null
        ? rawPrice
        : { amount: rawPrice, currency: rawCurrency };

  return sourceProductSchema.parse({
    // The adapter identity is authoritative. A payload's external retailer
    // label remains in rawPayload but cannot impersonate a disabled API source.
    sourceKey: "manual",
    sourceProductId: optionalString(
      firstDefined(raw, ["sourceProductId", "source_product_id", "productId", "asin"])
    ),
    title: optionalString(firstDefined(raw, ["title", "name"])),
    url: optionalString(firstDefined(raw, ["url", "productUrl", "product_url"])),
    affiliateUrl: optionalString(
      firstDefined(raw, ["affiliateUrl", "affiliate_url", "amazon_affiliate_url"])
    ),
    brand: optionalString(raw.brand),
    model: optionalString(firstDefined(raw, ["model", "series"])),
    cpu: firstDefined(raw, ["cpu", "processor"]),
    gpu: firstDefined(raw, ["gpu", "graphics"]),
    ramGb: firstDefined(raw, ["ramGb", "ram_gb", "ram"]),
    ramType: firstDefined(raw, ["ramType", "ram_type"]),
    ramUpgradeable: firstDefined(raw, ["ramUpgradeable", "ram_upgradeable"]),
    storageGb: firstDefined(raw, ["storageGb", "storage_gb", "storage"]),
    storageType: firstDefined(raw, ["storageType", "storage_type"]),
    storageUpgradeable: firstDefined(raw, ["storageUpgradeable", "storage_upgradeable"]),
    display: raw.display,
    weightKg: firstDefined(raw, ["weightKg", "weight_kg", "weight"]),
    batteryWh: firstDefined(raw, ["batteryWh", "battery_wh", "battery"]),
    operatingSystem: firstDefined(raw, ["operatingSystem", "operating_system", "os"]),
    warranty: raw.warranty,
    seller: firstDefined(raw, ["seller", "store"]),
    price,
    priceFetchedAt: optionalString(
      firstDefined(raw, ["priceFetchedAt", "price_fetched_at"])
    ),
    availability: optionalString(raw.availability),
    imageUrl: optionalString(firstDefined(raw, ["imageUrl", "image_url"])),
    fetchedAt:
      optionalString(firstDefined(raw, ["fetchedAt", "fetched_at"])) ?? now,
    features: optionalStringArray(firstDefined(raw, ["features", "featureBullets"])),
    rawPayload: raw,
  });
}

export const manualSourceAdapter: SourceAdapter = {
  key: "manual",
  displayName: "Manual import",
  mode: "manual",
  capabilities: {
    productId: false,
    productUrl: false,
    manualPayload: true,
    livePrice: false,
  },

  async getHealth() {
    return {
      sourceKey: this.key,
      displayName: this.displayName,
      mode: this.mode,
      enabled: true,
      configured: true,
      status: "ready",
      message: "Ready for admin-entered JSON. No external request is made.",
      checkedAt: new Date().toISOString(),
      capabilities: this.capabilities,
      remoteChecked: false,
      credentialStatus: "not_required",
    };
  },

  async fetchProduct(request) {
    if (request.payload === undefined) {
      throw new TypeError("Manual source requires a payload");
    }
    return manualPayloadToSourceProduct(request.payload);
  },
};

export { manualPayloadToSourceProduct };
