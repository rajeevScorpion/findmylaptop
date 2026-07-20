import { describe, expect, it } from "vitest";

import { evaluateBlogDraftQuality } from "./quality";

const completeBlocks: unknown[] = [
  { type: "heading", level: 2, text: "Choose the right CPU", id: "cpu" },
  { type: "heading", level: 2, text: "Check the display", id: "display" },
  { type: "heading", level: 2, text: "Plan for upgrades", id: "upgrades" },
  {
    type: "faq",
    items: [{ question: "How much RAM?", answer: "Match it to your workload." }],
  },
  {
    type: "cta",
    title: "Find a laptop",
    href: "/find-my-laptop",
  },
];

function quality(overrides: Partial<Parameters<typeof evaluateBlogDraftQuality>[0]> = {}) {
  return evaluateBlogDraftQuality({
    blocks: completeBlocks,
    researchConfidence: 100,
    researchThreshold: 80,
    blogThreshold: 100,
    sourceCount: 2,
    hasPersonaDisclosure: true,
    ...overrides,
  });
}

describe("blog draft quality", () => {
  it("passes a fully evidenced, valid, and complete draft", () => {
    const result = quality();

    expect(result).toMatchObject({ score: 100, passed: true });
    expect(result.checks.every((item) => item.status === "pass")).toBe(true);
  });

  it("keeps source depth advisory when one verified source is present", () => {
    const result = quality({ sourceCount: 1 });

    expect(result.passed).toBe(true);
    expect(result.checks.find((item) => item.key === "source-evidence")).toMatchObject({
      status: "pass",
    });
    expect(result.checks.find((item) => item.key === "source-depth")).toMatchObject({
      status: "warning",
    });
  });

  it.each(["This configuration costs INR 75,000.", "This configuration costs ₹75,000."])(
    "blocks exact price claims that need manual evidence review: %s",
    (priceClaim) => {
    const result = quality({
      blocks: [
        ...completeBlocks,
        { type: "paragraph", text: priceClaim },
      ],
      blogThreshold: 0,
    });

    expect(result.passed).toBe(false);
    expect(result.checks.find((item) => item.key === "unsupported-price")).toMatchObject({
      status: "fail",
    });
    }
  );

  it("fails invalid blocks and missing required article structure", () => {
    const result = quality({
      blocks: [
        { type: "paragraph", text: "A valid paragraph." },
        { type: "unknown", text: "Not part of the CMS vocabulary." },
      ],
      blogThreshold: 0,
    });

    expect(result.passed).toBe(false);
    expect(result.checks.find((item) => item.key === "block-validity")).toMatchObject({
      status: "fail",
    });
    expect(result.checks.find((item) => item.key === "article-structure")).toMatchObject({
      status: "fail",
    });
  });
});
