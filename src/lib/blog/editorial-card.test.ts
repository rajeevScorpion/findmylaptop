import { describe, expect, it } from "vitest";
import {
  combineEditorialDisclosure,
  placeEditorialCardAfterFaq,
} from "./editorial-card";

describe("editorial card placement", () => {
  it("folds the generated disclosure into a slot immediately after the FAQ", () => {
    const intro = { type: "paragraph", text: "Introduction" };
    const faq = {
      type: "faq",
      items: [{ question: "Question?", answer: "Answer." }],
    };
    const disclosure = {
      type: "callout",
      variant: "info",
      title: "Editorial disclosure",
      content: "AI persona disclosure and evidence policy.",
    };
    const cta = { type: "cta", title: "Find a laptop", href: "/" };

    expect(placeEditorialCardAfterFaq([intro, disclosure, faq, cta])).toEqual({
      beforeCard: [intro, faq],
      afterCard: [cta],
      generatedDisclosure: disclosure.content,
    });
  });

  it("keeps ordinary callouts and falls back to the end when no FAQ exists", () => {
    const tip = {
      type: "callout",
      variant: "tip",
      title: "Buying tip",
      content: "Compare warranty terms.",
    };

    expect(placeEditorialCardAfterFaq([tip])).toEqual({
      beforeCard: [tip],
      afterCard: [],
      generatedDisclosure: null,
    });
  });

  it("does not repeat persona text already present in the generated disclosure", () => {
    expect(
      combineEditorialDisclosure(
        "LaptopFinder editorial persona — not a real individual.",
        "LaptopFinder editorial persona — not a real individual. Evidence is reviewed before publication."
      )
    ).toBe(
      "LaptopFinder editorial persona — not a real individual. Evidence is reviewed before publication."
    );
  });
});
