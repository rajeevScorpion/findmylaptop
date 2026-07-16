import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canonicalizeSourceUrl,
  generateAffiliateUrl,
  parseAllowedSourceUrl,
} from "./policies";
import { buildAffiliateOutboundPath } from "./public";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("affiliate destination policies", () => {
  it("allows only policy-owned HTTP hosts without credentials or custom ports", () => {
    expect(
      parseAllowedSourceUrl(
        "amazon",
        "https://www.amazon.in/dp/B012345678"
      )?.hostname
    ).toBe("www.amazon.in");
    expect(
      parseAllowedSourceUrl(
        "amazon",
        "https://amazon.in.attacker.example/dp/B012345678"
      )
    ).toBeNull();
    expect(
      parseAllowedSourceUrl(
        "amazon",
        "https://user:secret@amazon.in/dp/B012345678"
      )
    ).toBeNull();
    expect(
      parseAllowedSourceUrl(
        "amazon",
        "https://amazon.in:8443/dp/B012345678"
      )
    ).toBeNull();
    expect(parseAllowedSourceUrl("amazon", "javascript:alert(1)")).toBeNull();
  });

  it("rebuilds Amazon links from the ASIN and drops stored tracking", () => {
    expect(
      canonicalizeSourceUrl({
        sourceKey: "amazon",
        value:
          "https://www.amazon.in/gp/product/B012345678?tag=old-21&utm_source=leak",
      })
    ).toBe("https://www.amazon.in/dp/B012345678");
  });

  it("turns manual marketplace evidence into a non-affiliate canonical link", () => {
    expect(
      canonicalizeSourceUrl({
        sourceKey: "manual",
        sourceProductId: "B012345678",
        value: "https://amzn.to/example-short-link?tag=old-21",
      })
    ).toBe("https://www.amazon.in/dp/B012345678");
    expect(
      canonicalizeSourceUrl({
        sourceKey: "manual",
        value: "https://amzn.to/unknown-short-link?tag=old-21",
      })
    ).toBeNull();
    expect(
      canonicalizeSourceUrl({
        sourceKey: "manual",
        value:
          "https://www.croma.com/example-laptop/p/123?irclickid=secret&partner=network&color=grey",
      })
    ).toBe("https://www.croma.com/example-laptop/p/123");
  });

  it("accepts Flipkart product pages but rejects allowlisted redirect endpoints", () => {
    expect(
      canonicalizeSourceUrl({
        sourceKey: "flipkart",
        value:
          "https://dl.flipkart.com/dl/example-laptop/p/itmABC123?pid=COMABC123&utm_source=feed&affid=stored",
      })
    ).toBe(
      "https://www.flipkart.com/example-laptop/p/itmABC123?pid=COMABC123"
    );
    expect(
      canonicalizeSourceUrl({
        sourceKey: "flipkart",
        value:
          "https://www.flipkart.com/affiliate/redirect?url=https%3A%2F%2Fattacker.example",
      })
    ).toBeNull();
    expect(
      canonicalizeSourceUrl({
        sourceKey: "manual",
        value:
          "https://www.croma.com/redirect?url=https%3A%2F%2Fattacker.example",
      })
    ).toBeNull();
  });

  it("generates tracking server-side only from configured source IDs", () => {
    const canonicalUrl = "https://www.amazon.in/dp/B012345678";
    expect(
      generateAffiliateUrl({ sourceKey: "amazon", canonicalUrl })
    ).toBeNull();

    vi.stubEnv("AMAZON_PARTNER_TAG", "laptopfinder-21");
    const generated = generateAffiliateUrl({
      sourceKey: "amazon",
      canonicalUrl,
    });
    expect(generated).not.toBeNull();
    const url = new URL(generated!);
    expect(url.hostname).toBe("www.amazon.in");
    expect(url.pathname).toBe("/dp/B012345678");
    expect(url.searchParams.get("tag")).toBe("laptopfinder-21");
  });
});

describe("public outbound paths", () => {
  it("contains identifiers and a validated placement, never a destination", () => {
    const path = buildAffiliateOutboundPath({
      laptopId: "11111111-1111-4111-8111-111111111111",
      offerId: "22222222-2222-4222-8222-222222222222",
      placement: "comparison",
    });
    expect(path).toBe(
      "/api/out?laptop=11111111-1111-4111-8111-111111111111&placement=comparison&offer=22222222-2222-4222-8222-222222222222"
    );
    expect(path).not.toContain("http");
  });
});
