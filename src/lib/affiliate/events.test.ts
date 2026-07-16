import { afterEach, describe, expect, it, vi } from "vitest";

import type { GrowthAgentDatabaseClient } from "@/lib/growth-agents/types";
import { recordAffiliateClick } from "./events";
import type { ResolvedAffiliateDestination } from "./resolver";

const resolved: ResolvedAffiliateDestination = {
  laptopId: "11111111-1111-4111-8111-111111111111",
  offerId: "22222222-2222-4222-8222-222222222222",
  sourceKey: "amazon",
  destinationUrl: "https://www.amazon.in/dp/B012345678?tag=private-21",
  destinationHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  destinationKind: "affiliate",
  monetized: true,
  cta: {
    label: "Check current price on Amazon India",
    sourceKey: "amazon",
    sourceName: "Amazon India",
    priceFreshness: "unavailable",
    price: null,
    availability: null,
    disclosure: "Disclosure",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("privacy-minimized affiliate click events", () => {
  it("inserts only aggregate-safe fields and never the raw destination", async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      from: vi.fn(() => ({ insert })),
    } as unknown as GrowthAgentDatabaseClient;

    await recordAffiliateClick(resolved, "product_card", client);

    expect(insert).toHaveBeenCalledWith({
      laptop_id: resolved.laptopId,
      offer_id: resolved.offerId,
      source_key: "amazon",
      placement: "product_card",
      destination_hash: resolved.destinationHash,
      destination_kind: "affiliate",
      monetized: true,
    });
    expect(JSON.stringify(insert.mock.calls)).not.toContain(
      resolved.destinationUrl
    );
  });

  it("does not block navigation when the analytics transport throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn().mockRejectedValue(new Error("sensitive transport detail")),
      })),
    } as unknown as GrowthAgentDatabaseClient;

    await expect(
      recordAffiliateClick(resolved, "comparison", client)
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "Affiliate click event insert request failed"
    );
  });
});
