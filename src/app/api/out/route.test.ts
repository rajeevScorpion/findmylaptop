import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordAffiliateClick } from "@/lib/affiliate/events";
import { resolveAffiliateDestination } from "@/lib/affiliate/resolver";
import { GET } from "./route";

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => unknown) => callback()),
  connection: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/affiliate/events", () => ({
  recordAffiliateClick: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/affiliate/resolver", () => ({
  resolveAffiliateDestination: vi.fn(),
}));

const LAPTOP_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.mocked(resolveAffiliateDestination).mockResolvedValue({
    laptopId: LAPTOP_ID,
    offerId: null,
    sourceKey: "amazon",
    destinationUrl: "https://www.amazon.in/dp/B012345678?tag=laptopfinder-21",
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
  });
});

describe("GET /api/out", () => {
  it("rejects destination-like and all other unexpected query parameters", async () => {
    const response = await GET(
      new Request(
        `https://laptopfinder.test/api/out?laptop=${LAPTOP_ID}&placement=product_card&url=https%3A%2F%2Fattacker.example`
      )
    );

    expect(response.status).toBe(400);
    expect(resolveAffiliateDestination).not.toHaveBeenCalled();
  });

  it("rejects duplicate identifiers and invalid placements", async () => {
    const duplicate = await GET(
      new Request(
        `https://laptopfinder.test/api/out?laptop=${LAPTOP_ID}&laptop=${LAPTOP_ID}&placement=product_card`
      )
    );
    const invalidPlacement = await GET(
      new Request(
        `https://laptopfinder.test/api/out?laptop=${LAPTOP_ID}&placement=attacker_controlled`
      )
    );

    expect(duplicate.status).toBe(400);
    expect(invalidPlacement.status).toBe(400);
    expect(resolveAffiliateDestination).not.toHaveBeenCalled();
  });

  it("redirects only to the server-resolved destination and records the click", async () => {
    const response = await GET(
      new Request(
        `https://laptopfinder.test/api/out?laptop=${LAPTOP_ID}&placement=comparison`
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.amazon.in/dp/B012345678?tag=laptopfinder-21"
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(resolveAffiliateDestination).toHaveBeenCalledWith({
      laptopId: LAPTOP_ID,
      placement: "comparison",
    });
    expect(recordAffiliateClick).toHaveBeenCalledWith(
      expect.objectContaining({ laptopId: LAPTOP_ID }),
      "comparison"
    );
  });
});
