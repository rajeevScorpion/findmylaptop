import { assessCandidate } from "./scoring";
import {
  normalizedLaptopSchema,
  sourceProductSchema,
  type NormalizedLaptop,
  type PriceFreshness,
  type SourceProduct,
} from "./types";

const PRICE_TTL_MS: Record<string, number> = {
  amazon: 60 * 60 * 1_000,
  flipkart: 24 * 60 * 60 * 1_000,
  manual: 24 * 60 * 60 * 1_000,
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function cleanText(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

function readText(
  record: Record<string, unknown> | undefined,
  keys: string[],
  maxLength = 500
): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = cleanText(record[key], maxLength);
    if (value) return value;
  }
  return undefined;
}

function positiveNumber(value: unknown, max: number): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= max) {
    return value;
  }
  if (typeof value !== "string") return undefined;
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= max ? parsed : undefined;
}

function capacityGb(value: unknown, max: number): number | undefined {
  const number = positiveNumber(value, max);
  if (number === undefined) return undefined;
  const text = typeof value === "string" ? value.toLowerCase() : "";
  const multiplier = /\btb\b/.test(text) ? 1_000 : 1;
  const result = Math.round(number * multiplier);
  return result > 0 && result <= max ? result : undefined;
}

function optionalBoolean(value: unknown): boolean | null | undefined {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["yes", "true", "upgradeable", "upgradable"].includes(normalized)) return true;
  if (["no", "false", "soldered", "not upgradeable", "not upgradable"].includes(normalized)) {
    return false;
  }
  if (["unknown", "unspecified"].includes(normalized)) return null;
  return undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T): T | undefined {
  const compacted = Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== "")
  ) as T;
  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function evidenceLine(lines: string[], pattern: RegExp): string | undefined {
  return lines.find((line) => pattern.test(line));
}

function normalizeCpu(value: unknown, evidence: string[]) {
  const record = asRecord(value);
  const explicitLabel = cleanText(value) ?? readText(record, ["label", "name", "fullName"]);
  const evidenceLabel = evidenceLine(
    evidence,
    /\b(?:intel\s+(?:core|celeron|pentium)|amd\s+ryzen|ryzen\s+[3579]|apple\s+m[1-9]|snapdragon\s+x)\b/i
  );
  const label = explicitLabel ?? evidenceLabel;
  const normalized = compactObject({
    label,
    manufacturer: readText(record, ["manufacturer", "brand", "vendor"], 80),
    family: readText(record, ["family", "series"], 100),
    generation: readText(record, ["generation", "gen"], 80),
    model: readText(record, ["model", "modelNumber", "partNumber"], 120),
  });
  return normalized;
}

function normalizeGpu(value: unknown, evidence: string[]) {
  const record = asRecord(value);
  const explicitLabel = cleanText(value) ?? readText(record, ["label", "name", "fullName"]);
  const evidenceLabel = evidenceLine(
    evidence,
    /\b(?:nvidia\s+(?:geforce\s+)?(?:rtx|gtx)|(?:rtx|gtx)\s*\d{3,4}|amd\s+radeon|intel\s+(?:arc|iris|uhd))\b/i
  );
  const label = explicitLabel ?? evidenceLabel;
  const dedicatedFromText = label
    ? /\b(?:nvidia|geforce|rtx|gtx|radeon\s+rx|intel\s+arc)\b/i.test(label)
      ? true
      : /\b(?:integrated|iris|uhd)\b/i.test(label)
        ? false
        : undefined
    : undefined;
  const normalized = compactObject({
    label,
    manufacturer: readText(record, ["manufacturer", "brand", "vendor"], 80),
    family: readText(record, ["family", "series"], 100),
    model: readText(record, ["model", "modelNumber"], 120),
    dedicated: optionalBoolean(record?.dedicated) ?? dedicatedFromText,
    vramGb: positiveNumber(record?.vramGb ?? record?.vram_gb ?? record?.vram, 128),
  });
  return normalized;
}

function normalizeDisplay(value: unknown, evidence: string[]) {
  const record = asRecord(value);
  const explicitLabel = cleanText(value) ?? readText(record, ["label", "name", "description"]);
  const evidenceLabel = evidenceLine(
    evidence,
    /\b(?:display|screen|panel|\d{2}(?:\.\d)?\s*(?:inch|\"))\b/i
  );
  const label = explicitLabel ?? evidenceLabel;
  const sizeFromLabel = label?.match(/(\d{2}(?:\.\d)?)\s*(?:inch|inches|\")/i)?.[1];
  const refreshFromLabel = label?.match(/(\d{2,3})\s*hz\b/i)?.[1];
  const resolutionFromLabel = label?.match(/\b(?:\d{3,4}\s*[xX]\s*\d{3,4}|(?:full\s*)?hd|qhd\+?|uhd|4k)\b/i)?.[0];
  const gamutFromLabel = label?.match(/\b\d{2,3}%\s*(?:sRGB|DCI-P3|NTSC|Adobe\s*RGB)\b/i)?.[0];
  return compactObject({
    label,
    sizeInches:
      positiveNumber(record?.sizeInches ?? record?.size_inches ?? record?.size, 30) ??
      positiveNumber(sizeFromLabel, 30),
    resolution: readText(record, ["resolution"], 80) ?? resolutionFromLabel,
    refreshRateHz:
      positiveNumber(record?.refreshRateHz ?? record?.refresh_rate_hz, 1_000) ??
      positiveNumber(refreshFromLabel, 1_000),
    colorGamut: readText(record, ["colorGamut", "color_gamut", "gamut"], 100) ?? gamutFromLabel,
    panelType: readText(record, ["panelType", "panel_type", "panel"], 80),
  });
}

function findRamGb(value: unknown, evidence: string[]): number | undefined {
  const explicit = capacityGb(value, 1_024);
  if (explicit !== undefined) return explicit;
  for (const line of evidence) {
    const match = line.match(/\b(\d{1,3})\s*GB\s*(?:DDR\d\w*\s*)?(?:RAM|memory)\b/i);
    if (match) return capacityGb(match[1], 1_024);
  }
  return undefined;
}

function findRamType(value: unknown, evidence: string[]): string | undefined {
  const explicit = cleanText(value, 80);
  if (explicit) return explicit;
  for (const line of evidence) {
    const match = line.match(/\b(?:LP)?DDR[345X]+\b/i);
    if (match) return match[0].toUpperCase();
  }
  return undefined;
}

function findStorage(value: unknown, evidence: string[]): {
  storageGb?: number;
  storageType?: "SSD" | "HDD" | "Hybrid" | "Unknown";
} {
  const explicit = capacityGb(value, 100_000);
  let label = cleanText(value);
  if (explicit === undefined) {
    label = evidenceLine(evidence, /\b\d+(?:\.\d+)?\s*(?:GB|TB)\s*(?:NVMe|PCIe|SSD|HDD)\b/i);
  }
  const storageGb = explicit ?? capacityGb(label, 100_000);
  const hasSsd = /\b(?:ssd|nvme|pcie)\b/i.test(label ?? "");
  const hasHdd = /\bhdd\b/i.test(label ?? "");
  const storageType = hasSsd && hasHdd ? "Hybrid" : hasSsd ? "SSD" : hasHdd ? "HDD" : undefined;
  return { storageGb, storageType };
}

function normalizeStorageType(value: unknown): "SSD" | "HDD" | "Hybrid" | "Unknown" | undefined {
  const text = cleanText(value)?.toLowerCase();
  if (!text) return undefined;
  if (text === "unknown") return "Unknown";
  if (text.includes("hybrid")) return "Hybrid";
  if (text.includes("ssd") || text.includes("nvme") || text.includes("pcie")) return "SSD";
  if (text.includes("hdd")) return "HDD";
  return undefined;
}

function normalizeMoney(
  value: unknown,
  sourceKey: string
): { amount: number; currency: string } | undefined {
  if (value === undefined || value === null) return undefined;
  const record = asRecord(value);
  const amountValue = record?.amount ?? record?.value ?? value;
  let amount: number | undefined;
  if (typeof amountValue === "number" && Number.isFinite(amountValue) && amountValue >= 0) {
    amount = amountValue;
  } else if (typeof amountValue === "string") {
    const cleaned = amountValue.replace(/,/g, "");
    const match = cleaned.match(/\d+(?:\.\d+)?/);
    if (match) amount = Number(match[0]);
  }
  if (amount === undefined || !Number.isFinite(amount) || amount < 0) return undefined;

  const explicitCurrency = cleanText(record?.currency, 3)?.toUpperCase();
  const currency =
    explicitCurrency ??
    (sourceKey === "amazon" || sourceKey === "flipkart" ? "INR" : undefined);
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return undefined;
  return { amount, currency };
}

export function getPriceFreshness(
  sourceKey: string,
  price: { amount: number; currency: string } | undefined,
  fetchedAt: string | undefined,
  now = new Date()
): PriceFreshness {
  if (!price) return "not_provided";
  if (!fetchedAt) return "unknown";
  const timestamp = new Date(fetchedAt).getTime();
  if (!Number.isFinite(timestamp)) return "unknown";
  const age = now.getTime() - timestamp;
  if (age < -5 * 60 * 1_000) return "unknown";
  const ttl = PRICE_TTL_MS[sourceKey] ?? PRICE_TTL_MS.manual;
  return age <= ttl ? "fresh" : "stale";
}

export function getPriceFreshUntil(sourceKey: string, fetchedAt?: string): string | null {
  if (!fetchedAt) return null;
  const timestamp = new Date(fetchedAt).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const ttl = PRICE_TTL_MS[sourceKey] ?? PRICE_TTL_MS.manual;
  return new Date(timestamp + ttl).toISOString();
}

/** Normalize only fields supported by explicit source evidence. Missing data stays omitted. */
export function normalizeProduct(input: SourceProduct, now = new Date()): NormalizedLaptop {
  const product = sourceProductSchema.parse(input);
  const evidence = [product.title, ...(product.features ?? [])]
    .map((line) => cleanText(line, 2_000))
    .filter((line): line is string => Boolean(line));
  const storage = findStorage(product.storageGb, evidence);
  const price = normalizeMoney(product.price, product.sourceKey);
  const priceFreshness = getPriceFreshness(
    product.sourceKey,
    price,
    product.priceFetchedAt,
    now
  );

  const assessable = {
    sourceKey: product.sourceKey,
    sourceProductId: cleanText(product.sourceProductId, 256),
    title: cleanText(product.title, 500)!,
    brand: cleanText(product.brand, 160),
    model: cleanText(product.model, 200),
    cpu: normalizeCpu(product.cpu, evidence),
    gpu: normalizeGpu(product.gpu, evidence),
    ramGb: findRamGb(product.ramGb, evidence),
    ramType: findRamType(product.ramType, evidence),
    ramUpgradeable: optionalBoolean(product.ramUpgradeable),
    storageGb: storage.storageGb,
    storageType: normalizeStorageType(product.storageType) ?? storage.storageType,
    storageUpgradeable: optionalBoolean(product.storageUpgradeable),
    display: normalizeDisplay(product.display, evidence),
    weightKg: positiveNumber(product.weightKg, 20),
    batteryWh: positiveNumber(product.batteryWh, 500),
    operatingSystem: cleanText(product.operatingSystem, 160),
    warranty: cleanText(product.warranty, 300),
    seller: cleanText(product.seller, 300),
    price,
    priceFetchedAt: product.priceFetchedAt,
    priceFreshness,
    availability: cleanText(product.availability, 200),
    url: product.url,
    affiliateUrl: product.affiliateUrl,
    imageUrl: product.imageUrl,
    fetchedAt: product.fetchedAt,
  };
  const assessment = assessCandidate(assessable);

  return normalizedLaptopSchema.parse({ ...assessable, ...assessment });
}
