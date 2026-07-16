import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAgentSettings } from "@/lib/growth-agents/settings";
import type { GrowthAgentDatabaseClient } from "@/lib/growth-agents/types";
import {
  getAffiliateCtaMetadataForLaptops,
  resolveAffiliateDestination,
} from "./resolver";

vi.mock("@/lib/growth-agents/settings", () => ({
  getAgentSettings: vi.fn(),
}));

const LAPTOP_ID = "11111111-1111-4111-8111-111111111111";
const OFFER_ID = "22222222-2222-4222-8222-222222222222";

const settings = {
  globalPause: false,
  emergencyStop: false,
  researchAgentEnabled: false,
  bloggingAgentEnabled: false,
  chipLearningEnabled: false,
  affiliateLinksEnabled: true,
  safeMode: false,
  retention: {
    rawProductPayloadsDays: 30,
    chipInteractionEventsDays: 30,
    anonymousSessionProfilesDays: 30,
    agentJobsDays: 30,
    affiliateClickEventsDays: 90,
    auditEventsDays: 180,
  },
};

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    source_key: "amazon",
    display_name: "Amazon India",
    mode: "api",
    enabled: true,
    credential_status: "valid",
    freshness_ttl_minutes: 60,
    public_display_allowed: true,
    requires_admin_approval: true,
    last_health_check_at: null,
    last_success_at: null,
    last_error_at: null,
    last_error_message: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function offer(overrides: Record<string, unknown> = {}) {
  return {
    id: OFFER_ID,
    laptop_id: LAPTOP_ID,
    source_key: "amazon",
    source_product_id: "B012345678",
    product_url: "https://www.amazon.in/dp/B012345678?tag=stored-21",
    affiliate_url: "https://www.amazon.in/dp/B012345678?tag=legacy-21",
    price_amount: 74999,
    price_currency: "INR",
    price_fetched_at: "2026-07-16T11:30:00.000Z",
    availability: "In stock",
    source_fetched_at: "2026-07-16T11:30:00.000Z",
    fresh_until: "2026-07-16T12:30:00.000Z",
    compliance_status: "safe",
    is_active: true,
    ...overrides,
  };
}

function fakeBulkClient(input: {
  sources?: unknown[];
  offers?: unknown[];
  laptops?: unknown[];
}): GrowthAgentDatabaseClient {
  const results: Record<string, { data: unknown[]; error: null }> = {
    laptops: {
      data: input.laptops ?? [
        {
          id: LAPTOP_ID,
          slug: "evidence-laptop",
          is_published: true,
          asin: "B012345678",
          amazon_affiliate_url:
            "https://www.amazon.in/dp/B012345678?tag=legacy-21",
        },
      ],
      error: null,
    },
    source_adapters: { data: input.sources ?? [source()], error: null },
    product_offers: { data: input.offers ?? [offer()], error: null },
  };
  return {
    from(table: string) {
      const result = results[table];
      const chain = {
        select: () => chain,
        in: () => chain,
        eq: () => chain,
        order: () => chain,
        then: (
          resolve: (value: typeof result) => unknown,
          reject?: (reason: unknown) => unknown
        ) => Promise.resolve(result).then(resolve, reject),
      };
      return chain;
    },
  } as unknown as GrowthAgentDatabaseClient;
}

function fakeClient(input: {
  sources?: unknown[];
  offers?: unknown[];
  legacyUrl?: string | null;
  asin?: string | null;
}): GrowthAgentDatabaseClient {
  const results: Record<string, { data: unknown; error: null }> = {
    laptops: {
      data: {
        id: LAPTOP_ID,
        slug: "evidence-laptop",
        is_published: true,
        asin: input.asin ?? null,
        amazon_affiliate_url: input.legacyUrl ?? null,
      },
      error: null,
    },
    source_adapters: { data: input.sources ?? [source()], error: null },
    product_offers: { data: input.offers ?? [offer()], error: null },
  };

  return {
    from(table: string) {
      const result = results[table];
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        maybeSingle: async () => result,
        then: (
          resolve: (value: typeof result) => unknown,
          reject?: (reason: unknown) => unknown
        ) => Promise.resolve(result).then(resolve, reject),
      };
      return chain;
    },
  } as unknown as GrowthAgentDatabaseClient;
}

beforeEach(() => {
  vi.mocked(getAgentSettings).mockResolvedValue(settings);
  vi.stubEnv("AMAZON_PARTNER_TAG", "laptopfinder-21");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("central affiliate resolution", () => {
  it("bulk-resolves public display metadata without exposing destinations", async () => {
    const metadata = await getAffiliateCtaMetadataForLaptops([LAPTOP_ID], {
      client: fakeBulkClient({}),
      now: new Date("2026-07-16T12:00:00.000Z"),
    });
    expect(metadata.get(LAPTOP_ID)).toMatchObject({
      sourceKey: "amazon",
      sourceName: "Amazon India",
      price: {
        amount: 74999,
        currency: "INR",
        fetchedAt: "2026-07-16T11:30:00.000Z",
        validUntil: "2026-07-16T12:30:00.000Z",
      },
      availability: {
        label: "In stock",
        fetchedAt: "2026-07-16T11:30:00.000Z",
        validUntil: "2026-07-16T12:30:00.000Z",
      },
    });
    expect(JSON.stringify(metadata.get(LAPTOP_ID))).not.toContain(
      "amazon.in"
    );
    expect(JSON.stringify(metadata.get(LAPTOP_ID))).not.toContain("tag=");
  });

  it("regenerates an allowlisted affiliate URL and exposes only fresh price metadata", async () => {
    const result = await resolveAffiliateDestination(
      { laptopId: LAPTOP_ID, placement: "product_card" },
      {
        client: fakeClient({}),
        now: new Date("2026-07-16T12:00:00.000Z"),
      }
    );

    const destination = new URL(result.destinationUrl);
    expect(destination.origin + destination.pathname).toBe(
      "https://www.amazon.in/dp/B012345678"
    );
    expect(destination.searchParams.get("tag")).toBe("laptopfinder-21");
    expect(destination.searchParams.get("tag")).not.toBe("stored-21");
    expect(result).toMatchObject({
      destinationKind: "affiliate",
      monetized: true,
      destinationHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      cta: {
        priceFreshness: "fresh",
        price: { amount: 74999, currency: "INR" },
      },
    });
  });

  it("withholds stale or source-disallowed price metadata", async () => {
    const stale = await resolveAffiliateDestination(
      { laptopId: LAPTOP_ID, placement: "product_card" },
      {
        client: fakeClient({
          offers: [
            offer({
              price_fetched_at: "2026-07-16T10:59:59.000Z",
              fresh_until: "2026-07-16T13:00:00.000Z",
            }),
          ],
        }),
        now: new Date("2026-07-16T12:00:00.000Z"),
      }
    );
    expect(stale.cta.price).toBeNull();
    expect(stale.cta.priceFreshness).toBe("stale");

    const sourceDisallowed = await resolveAffiliateDestination(
      { laptopId: LAPTOP_ID, placement: "product_card" },
      {
        client: fakeClient({
          sources: [source({ public_display_allowed: false })],
        }),
        now: new Date("2026-07-16T12:00:00.000Z"),
      }
    );
    expect(sourceDisallowed.cta.price).toBeNull();
  });

  it.each([
    {
      name: "the global feature is disabled",
      resolvedSettings: { ...settings, affiliateLinksEnabled: false },
      sourceRow: source(),
    },
    {
      name: "safe mode is active",
      resolvedSettings: { ...settings, safeMode: true },
      sourceRow: source(),
    },
    {
      name: "the source is disabled",
      resolvedSettings: settings,
      sourceRow: source({ enabled: false }),
    },
    {
      name: "public display is not approved",
      resolvedSettings: settings,
      sourceRow: source({ public_display_allowed: false }),
    },
  ])("falls back to a canonical URL when $name", async ({ resolvedSettings, sourceRow }) => {
    vi.mocked(getAgentSettings).mockResolvedValue(resolvedSettings);
    const result = await resolveAffiliateDestination(
      { laptopId: LAPTOP_ID, placement: "comparison" },
      { client: fakeClient({ sources: [sourceRow] }) }
    );

    expect(result.destinationUrl).toBe(
      "https://www.amazon.in/dp/B012345678"
    );
    expect(result.destinationKind).toBe("canonical");
    expect(result.monetized).toBe(false);
  });

  it("fails closed to a canonical URL when feature controls cannot be read", async () => {
    vi.mocked(getAgentSettings).mockRejectedValue(new Error("unavailable"));
    const result = await resolveAffiliateDestination(
      { laptopId: LAPTOP_ID, placement: "product_card" },
      { client: fakeClient({}) }
    );

    expect(result.destinationKind).toBe("canonical");
    expect(result.monetized).toBe(false);
  });

  it("rejects a disallowed stored host instead of becoming an open redirect", async () => {
    await expect(
      resolveAffiliateDestination(
        { laptopId: LAPTOP_ID, placement: "blog_product" },
        {
          client: fakeClient({
            offers: [
              offer({
                product_url:
                  "https://amazon.in.attacker.example/dp/B012345678",
                affiliate_url: null,
              }),
            ],
          }),
        }
      )
    ).rejects.toMatchObject({ code: "AFFILIATE_RESOLUTION_FAILED" });
  });

  it("never substitutes the legacy retailer for an explicitly selected unsafe offer", async () => {
    await expect(
      resolveAffiliateDestination(
        {
          laptopId: LAPTOP_ID,
          offerId: OFFER_ID,
          placement: "where_to_buy",
        },
        {
          client: fakeClient({
            offers: [offer({ compliance_status: "blocked" })],
            asin: "B012345678",
            legacyUrl: "https://www.amazon.in/dp/B012345678?tag=legacy-21",
          }),
        }
      )
    ).rejects.toMatchObject({ code: "AFFILIATE_RESOLUTION_FAILED" });
  });
});
