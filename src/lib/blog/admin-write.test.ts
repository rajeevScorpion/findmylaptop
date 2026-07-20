import { describe, expect, it, vi } from "vitest";
import { blogPostWriteSchema } from "./admin-write-schema";
import { writeBlogPost } from "./admin-write";

function input() {
  return blogPostWriteSchema.parse({
    postId: null,
    title: "Server-authored identity",
    slug: "server-authored-identity",
    excerpt: "",
    content: {
      type: "doc",
      blocks: [{ type: "heading", level: 2, text: "Overview", id: "" }],
    },
    status: "draft",
    templateType: "buying_guide",
    audience: ["students"],
    primaryKeyword: "",
    secondaryKeywords: [],
    metaTitle: "",
    metaDescription: "",
    canonicalUrl: "",
    ogImageUrl: "",
    categoryId: null,
    aiInputs: {
      topic: "Server-authored identity",
      brief: "",
      sourceText: "",
      targetLength: "medium",
      audience: "students",
      template: "buying_guide",
    },
    authorPersonaId: null,
    personaSelectionReason: "",
    personaGenerated: false,
    refreshPersonaSnapshot: false,
  });
}

describe("writeBlogPost", () => {
  it("derives creator identity and generated metadata on the server", async () => {
    const insert = vi.fn((_row: Record<string, unknown>) => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "10000000-0000-4000-8000-000000000001",
            slug: "server-authored-identity",
            status: "draft",
          },
          error: null,
        }),
      })),
    }));
    const client = { from: vi.fn(() => ({ insert })) };

    await writeBlogPost(
      input(),
      "trusted-admin@example.com",
      client as never
    );

    expect(insert).toHaveBeenCalledOnce();
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.created_by).toBe("trusted-admin@example.com");
    expect(row.updated_by).toBe("trusted-admin@example.com");
    expect(row.toc_json).toEqual([{ id: "overview", text: "Overview", level: 2 }]);
    expect(row.reading_time_minutes).toBe(1);
    expect(row).not.toHaveProperty("author_persona_snapshot_json");
    expect(row).not.toHaveProperty("research_input_ids");
  });

  it("builds a persona snapshot from the trusted database row", async () => {
    const personaId = "27000000-0000-4000-8000-000000000001";
    const insert = vi.fn((_row: Record<string, unknown>) => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "10000000-0000-4000-8000-000000000002",
            slug: "server-authored-identity",
            status: "draft",
          },
          error: null,
        }),
      })),
    }));
    const personaQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: personaId,
              slug: "trusted-guide",
              display_name: "Trusted Guide",
              public_role: "Editorial Guide",
              short_bio: "A transparent editorial persona.",
              author_type: "ai_persona",
              version: 4,
              avatar_url: null,
              expertise_tags: ["laptops"],
              disclosure_text: "Editorial persona, not a real individual.",
              status: "active",
            },
            error: null,
          }),
        })),
      })),
    };
    const client = {
      from: vi.fn((table: string) =>
        table === "blog_author_personas" ? personaQuery : { insert }
      ),
    };
    const value = input();
    value.authorPersonaId = personaId;
    value.refreshPersonaSnapshot = true;

    await writeBlogPost(value, "trusted-admin@example.com", client as never);

    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.author_persona_snapshot_json).toMatchObject({
      id: personaId,
      displayName: "Trusted Guide",
      version: 4,
    });
    expect(row.author_persona_version).toBe(4);
    expect(row.author_type).toBe("ai_persona");
  });

  it("rejects an inactive persona for a new attribution", async () => {
    const personaId = "27000000-0000-4000-8000-000000000002";
    const personaQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: personaId,
              slug: "archived-guide",
              display_name: "Archived Guide",
              public_role: "Editorial Guide",
              short_bio: "An archived editorial persona.",
              author_type: "ai_persona",
              version: 2,
              avatar_url: null,
              expertise_tags: ["laptops"],
              disclosure_text: "Editorial persona, not a real individual.",
              status: "archived",
            },
            error: null,
          }),
        })),
      })),
    };
    const client = {
      from: vi.fn((table: string) =>
        table === "blog_author_personas" ? personaQuery : {}
      ),
    };
    const value = input();
    value.authorPersonaId = personaId;
    value.refreshPersonaSnapshot = true;

    await expect(
      writeBlogPost(value, "trusted-admin@example.com", client as never)
    ).rejects.toMatchObject({ code: "INVALID_REFERENCE", status: 400 });
  });
});
