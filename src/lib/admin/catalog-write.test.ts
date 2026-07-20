import { describe, expect, it, vi } from "vitest";
import {
  courseMutationSchema,
  laptopMutationSchema,
} from "./catalog-write-schema";
import { writeCourseMutation, writeLaptopMutation } from "./catalog-write";

function laptopValues() {
  return {
    name: "Example Laptop 14",
    domain: "design" as const,
    brand: "Example",
    model: "14",
    price_approx: 79990,
    price_label: "₹79,990",
    amazon_affiliate_url: "https://www.amazon.in/dp/B0ABCDEF12",
    asin: "B0ABCDEF12",
    image_url: null,
    cpu: "Example CPU",
    gpu: null,
    gpu_vram_gb: null,
    ram: "16 GB",
    ram_gb: 16,
    storage: "512 GB SSD",
    storage_gb: 512,
    display: "14-inch IPS",
    weight: "1.4 kg",
    os: "Windows 11",
    tier: "balanced" as const,
    workload_tags: ["portable"],
    recommended_for_courses: [],
    not_ideal_for: [],
    why_recommended: null,
    cautions: null,
    upgrade_notes: null,
    four_year_suitability: "good" as const,
    priority_score: 50,
    is_published: false,
    raw_input: null,
  };
}

describe("writeLaptopMutation", () => {
  it("generates catalog identity and creator metadata on the server", async () => {
    const insert = vi.fn((row: Record<string, unknown>) => ({
      select: vi.fn(() => ({
        single: vi.fn().mockImplementation(async () => ({
          data: { id: row.id, slug: row.slug },
          error: null,
        })),
      })),
    }));
    const client = { from: vi.fn(() => ({ insert })) };
    const input = laptopMutationSchema.parse({
      action: "save",
      laptopId: null,
      values: laptopValues(),
    });

    const result = await writeLaptopMutation(
      input,
      "trusted-admin@example.com",
      client as never
    );

    const row = insert.mock.calls[0][0];
    expect(row.created_by).toBe("trusted-admin@example.com");
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.slug).toBe(`example-laptop-14-${String(row.id).slice(0, 8)}`);
    expect(result.id).toBe(row.id);
  });

  it("derives the formatted price label instead of accepting one", async () => {
    const update = vi.fn((row: Record<string, unknown>) => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "10000000-0000-4000-8000-000000000001",
              slug: "example-laptop",
            },
            error: null,
          }),
        })),
      })),
    }));
    const client = { from: vi.fn(() => ({ update })) };
    const input = laptopMutationSchema.parse({
      action: "set_price",
      laptopId: "10000000-0000-4000-8000-000000000001",
      value: 157990,
    });

    const result = await writeLaptopMutation(
      input,
      "trusted-admin@example.com",
      client as never
    );

    expect(update.mock.calls[0][0]).toEqual({
      price_approx: 157990,
      price_label: "₹1,57,990",
    });
    expect(result.priceLabel).toBe("₹1,57,990");
  });
});

describe("writeCourseMutation", () => {
  it("derives the new sort order on the server", async () => {
    const sortQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { sort_order: 402 },
                error: null,
              }),
            })),
          })),
        })),
      })),
    };
    const insert = vi.fn((row: Record<string, unknown>) => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "20000000-0000-4000-8000-000000000001" },
          error: null,
        }),
      })),
    }));
    const client = {
      from: vi.fn().mockReturnValueOnce(sortQuery).mockReturnValueOnce({ insert }),
    };
    const input = courseMutationSchema.parse({
      action: "add",
      domain: "technology",
      category: "Data & AI",
      name: "Applied AI",
    });

    await writeCourseMutation(input, client as never);

    expect(insert.mock.calls[0][0]).toMatchObject({
      domain: "technology",
      category: "Data & AI",
      name: "Applied AI",
      workload_level: "balanced",
      sort_order: 403,
    });
  });
});
