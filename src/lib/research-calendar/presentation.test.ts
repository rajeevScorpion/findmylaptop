import { describe, expect, it } from "vitest";
import {
  researchPacketAuditPresentation,
  researchRunPresentation,
} from "./presentation";

describe("researchRunPresentation", () => {
  it("shows a structured duplicate as an operational warning", () => {
    expect(
      researchRunPresentation({
        status: "no_good_topic",
        resultJson: {
          selectionSummary: {
            primaryReason: "duplicate_topic",
            message: "This topic was covered recently.",
            rejectionCounts: { duplicate_topic: 1 },
          },
        },
      })
    ).toEqual({
      label: "No new qualifying topic",
      reasonLabel: "Recently covered",
      detail: "This topic was covered recently.",
      tone: "warning",
    });
  });

  it("supports legacy no-topic runs", () => {
    expect(
      researchRunPresentation({
        status: "no_good_topic",
        resultJson: { noGoodTopicReason: "No fresh official evidence." },
      })
    ).toMatchObject({
      detail: "No fresh official evidence.",
      reasonLabel: null,
      tone: "warning",
    });
  });

  it("gives a successful mixed selection a useful secondary reason", () => {
    expect(
      researchRunPresentation({
        status: "succeeded",
        resultJson: {
          selectionSummary: {
            message: "Created one packet and skipped one duplicate.",
            rejectionCounts: { duplicate_topic: 1 },
          },
        },
      })
    ).toMatchObject({
      reasonLabel: "Some topics recently covered",
      tone: "warning",
    });
  });

  it("chooses the most common mixed rejection with a stable tie-break", () => {
    const resultJson = {
      selectionSummary: {
        rejectionCounts: {
          source_rotation: 2,
          insufficient_evidence: 2,
          duplicate_topic: 1,
        },
      },
    };

    expect(
      researchRunPresentation({ status: "succeeded", resultJson }).reasonLabel
    ).toBe("Some evidence too weak");
  });

  it("handles malformed old data without throwing", () => {
    expect(
      researchRunPresentation({ status: "succeeded", resultJson: [] })
    ).toEqual({
      label: "succeeded",
      reasonLabel: null,
      detail: null,
      tone: "success",
    });
  });
});

describe("researchPacketAuditPresentation", () => {
  it("labels nullable legacy novelty values clearly", () => {
    expect(
      researchPacketAuditPresentation({
        noveltyScore: null,
        nearestTopicSimilarity: null,
      })
    ).toMatchObject({
      noveltyScoreLabel: "Not recorded (legacy packet)",
      nearestTopicKindLabel: "None recorded",
      nearestTopicTitleLabel: "None recorded",
      nearestTopicSimilarityLabel: "None recorded",
    });
  });

  it("formats audit values and keeps only unique safe HTTP sources", () => {
    expect(
      researchPacketAuditPresentation({
        noveltyScore: 72.34,
        nearestTopicSimilarity: 27.66,
        nearestTopicKind: "blog_post",
        nearestTopicTitle: "Previously published guide",
        sourceDomains: ["WWW.Adobe.com", "nvidia.com"],
        sourceRefs: [
          { url: "https://www.adobe.com/products/example", title: "Adobe" },
          { url: "https://www.adobe.com/products/example", title: "Duplicate" },
          { url: "javascript:alert(1)", title: "Unsafe" },
          { url: "https://developer.nvidia.com/guide" },
        ],
      })
    ).toEqual({
      noveltyScoreLabel: "72.3%",
      nearestTopicKindLabel: "Blog post",
      nearestTopicTitleLabel: "Previously published guide",
      nearestTopicSimilarityLabel: "27.7%",
      sourceDomains: ["adobe.com", "developer.nvidia.com", "nvidia.com"],
      sourceLinks: [
        {
          domain: "adobe.com",
          title: "Adobe",
          url: "https://www.adobe.com/products/example",
        },
        {
          domain: "developer.nvidia.com",
          title: null,
          url: "https://developer.nvidia.com/guide",
        },
      ],
    });
  });
});
