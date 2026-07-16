import { describe, expect, it } from "vitest";
import { blogPostWriteSchema } from "./admin-write-schema";

function validWrite() {
  return {
    postId: null,
    title: "A bounded admin post",
    slug: "a-bounded-admin-post",
    excerpt: "A short excerpt.",
    content: {
      type: "doc" as const,
      blocks: [{ type: "paragraph", text: "Useful content." }],
    },
    status: "draft" as const,
    templateType: "buying_guide",
    audience: ["students"],
    primaryKeyword: "student laptop",
    secondaryKeywords: ["portable laptop"],
    metaTitle: "A bounded admin post",
    metaDescription: "A bounded description.",
    canonicalUrl: "",
    ogImageUrl: "https://example.com/post.png",
    categoryId: null,
    aiInputs: {
      topic: "Student laptops",
      brief: "",
      sourceText: "",
      targetLength: "medium" as const,
      audience: "students",
      template: "buying_guide",
    },
    authorPersonaId: null,
    personaSelectionReason: "",
    personaGenerated: false,
    refreshPersonaSnapshot: false,
  };
}

describe("blogPostWriteSchema", () => {
  it("accepts the bounded editor payload", () => {
    expect(blogPostWriteSchema.safeParse(validWrite()).success).toBe(true);
  });

  it("rejects browser-supplied identity and persona snapshots", () => {
    const forged = {
      ...validWrite(),
      createdBy: "attacker@example.com",
      authorPersonaSnapshot: { displayName: "Forged" },
    };

    expect(blogPostWriteSchema.safeParse(forged).success).toBe(false);
  });

  it("rejects oversized article content", () => {
    const oversized = validWrite();
    oversized.content.blocks = [
      { type: "paragraph", text: "x".repeat(500_001) },
    ];

    expect(blogPostWriteSchema.safeParse(oversized).success).toBe(false);
  });

  it("rejects non-HTTP public URLs", () => {
    const unsafeUrl = { ...validWrite(), canonicalUrl: "javascript:alert(1)" };
    expect(blogPostWriteSchema.safeParse(unsafeUrl).success).toBe(false);
  });
});
