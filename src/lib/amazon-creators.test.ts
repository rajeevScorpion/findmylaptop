import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Amazon Creators catalog search", () => {
  it("uses the official search endpoint and returns a bounded normalized result", async () => {
    vi.stubEnv("AMAZON_CREATORS_CLIENT_ID", "client-id");
    vi.stubEnv("AMAZON_CREATORS_CLIENT_SECRET", "client-secret");
    vi.stubEnv("AMAZON_PARTNER_TAG", "laptopfinder-21");
    vi.stubEnv("AMAZON_MARKETPLACE", "www.amazon.in");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: "token", expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({
        itemsResult: {
          items: [{
            asin: "B0ABC12345",
            itemInfo: {
              title: { displayValue: "Example Laptop 16GB 512GB" },
              byLineInfo: { brand: { displayValue: "Example" } },
              features: { displayValues: ["16 GB RAM", "512 GB SSD"] },
            },
            offersV2: { listings: [{ price: { money: { displayAmount: "INR 79,990.00" } }, availability: { message: "In stock" } }] },
            images: { primary: { large: { url: "https://example.com/laptop.jpg" } } },
          }],
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { searchAmazonProducts } = await import("./amazon-creators");
    const result = await searchAmazonProducts({ keywords: "student laptop 16GB", itemCount: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://creatorsapi.amazon/catalog/v1/searchItems");
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(request).toMatchObject({ method: "POST", cache: "no-store", signal: expect.any(AbortSignal) });
    expect(JSON.parse(String(request.body))).toMatchObject({
      keywords: "student laptop 16GB",
      searchIndex: "Computers",
      itemCount: 10,
      partnerTag: "laptopfinder-21",
      marketplace: "www.amazon.in",
    });
    expect(result).toEqual([expect.objectContaining({ asin: "B0ABC12345", title: "Example Laptop 16GB 512GB", priceAmount: 79_990 })]);
  });

  it("rejects broad empty keyword requests before making an API call", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { searchAmazonProducts } = await import("./amazon-creators");
    await expect(searchAmazonProducts({ keywords: "  " })).rejects.toThrow("3 to 200");
    expect(fetch).not.toHaveBeenCalled();
  });
});
