import { describe, expect, it } from "vitest";

import type { GeneratedResearchPacket, ResearchCalendar } from "./types";
import {
  applySourceCooldown,
  buildTopicNoveltyFeatures,
  canonicalizeResearchUrl,
  evaluateTopicNovelty,
  evaluateTopicNoveltyBatch,
  exactTopicFingerprint,
  getResearchNoveltyPolicy,
  researchRootDomain,
  resolveResearchNoveltyPolicy,
  selectNovelResearchPackets,
  sourceRotationDomains,
  type NoveltyReference,
  type NoveltyTopic,
} from "./novelty";

const NOW = new Date("2026-07-20T12:00:00.000Z");

const OLD_ADOBE_TITLE =
  "Adobe Creative Cloud 2026 compatibility: the laptop checklist design students need before updating Illustrator";
const OLD_ADOBE_ANGLE =
  "Translate Adobe’s April 2026 Creative Cloud support policy and Illustrator 30.x requirements into a practical pre-purchase and pre-update checklist. The core editorial value is separating “can install” from “is sensibly configured for Illustrator coursework,” while flagging operating-system support as an update-risk issue rather than only a hardware issue.";
const OLD_ADOBE_SUMMARY =
  "A strong, current software-guide angle for Indian design students using Adobe Illustrator. Adobe’s current guidance makes operating-system version, RAM, display resolution, SSD space, GPU API/VRAM support, driver updates, and account/internet requirements directly relevant to laptop suitability. The piece can advise readers to verify these items before accepting a software update or selecting a laptop, without making product, price, benchmark, or marketplace claims.";
const NEW_ADOBE_TITLE =
  "Adobe 2026 requirements for design students: buy for the heaviest course workflow, not the install minimum";
const NEW_ADOBE_ANGLE =
  "Translate Adobe’s current Illustrator and Premiere requirements into a practical laptop-requirements guide for design students whose coursework may span vector graphics and HD/4K video.";
const NEW_ADOBE_SUMMARY =
  "A high-confidence software-guide angle because Adobe’s current official pages show a meaningful gap between lightweight vector-work requirements and video-editing recommendations. The guide can explain that an 8 GB RAM laptop may meet stated minimums for Illustrator and Premiere HD editing, but Adobe recommends 16 GB for Illustrator and for HD work in Premiere, while 32 GB or more is recommended for Premiere 4K-and-higher workflows. It can also distinguish general storage capacity from workflow storage: Premiere calls for a fast internal SSD for the app/cache plus a separate high-speed media drive. Avoid product picks, prices, benchmark claims, and unsupported claims that a newer Windows release is incompatible.";

const OLD_ILLUSTRATOR_URL =
  "https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/technical-requirements.html?linkId=100000377474902";
const NEW_ILLUSTRATOR_URL =
  "https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/technical-requirements.html?linkId=100000296851625";

function packet(input: {
  title: string;
  angle: string;
  summary?: string;
  urls?: string[];
  confidence?: number;
  contentType?: GeneratedResearchPacket["contentType"];
}): GeneratedResearchPacket {
  return {
    topicTitle: input.title,
    topicAngle: input.angle,
    summary:
      input.summary ??
      "A sufficiently detailed research summary for deterministic novelty testing.",
    findings: (input.urls ?? ["https://example.com/source"]).map((url, index) => ({
      title: `Finding ${index + 1}`,
      summary: "A sufficiently detailed source finding.",
      evidence: "Direct evidence from the linked source.",
      sourceUrl: url,
      sourceTitle: `Source ${index + 1}`,
      publishedAt: null,
      confidenceScore: 90,
      timeSensitive: false,
    })),
    suggestedPersonas: [],
    confidenceScore: input.confidence ?? 90,
    urgency: "medium",
    contentType: input.contentType ?? "software-guide",
    monetizationIntent: "none",
  };
}

function reference(
  input: Partial<NoveltyReference> & Pick<NoveltyReference, "id" | "title">
): NoveltyReference {
  return {
    id: input.id,
    kind: input.kind ?? "research_packet",
    title: input.title,
    angle: input.angle ?? "A sufficiently detailed prior editorial angle.",
    summary: input.summary ?? "A sufficiently detailed prior research summary.",
    contentType: input.contentType ?? "software-guide",
    audiences: input.audiences ?? [],
    sourceUrls: input.sourceUrls ?? [],
    confidenceScore: input.confidenceScore ?? 90,
    createdAt: input.createdAt ?? "2026-07-20T10:00:00.000Z",
    status: input.status ?? "used",
    calendarDayId: input.calendarDayId ?? "tuesday",
    scheduleRunId: input.scheduleRunId ?? "run-1",
  };
}

describe("research novelty policy", () => {
  it("uses safe defaults and converts the admin percentage to a 0-1 threshold", () => {
    expect(resolveResearchNoveltyPolicy()).toEqual({
      windowDays: 180,
      similarityThreshold: 0.62,
      sourceRotationEnabled: true,
      sourceCooldownDays: 14,
      sourceCooldownRuns: 2,
    });

    expect(
      getResearchNoveltyPolicy({
        novelty_window_days: 120,
        novelty_similarity_threshold: 68,
        source_rotation_enabled: false,
      } as ResearchCalendar)
    ).toEqual({
      windowDays: 120,
      similarityThreshold: 0.68,
      sourceRotationEnabled: false,
      sourceCooldownDays: 14,
      sourceCooldownRuns: 2,
    });
  });

  it("builds the readable database fingerprint independently of the rich subject key", () => {
    expect(exactTopicFingerprint("  Adobe 2026: RAM & GPU!  ")).toBe(
      "adobe 2026 ram gpu"
    );
    expect(exactTopicFingerprint("Adobe-2026 RAM / GPU")).toBe(
      "adobe 2026 ram gpu"
    );
    expect(exactTopicFingerprint("C++ requirements")).toBe(
      "cplusplus requirements"
    );
    expect(exactTopicFingerprint("C# requirements")).toBe(
      "csharp requirements"
    );
    expect(exactTopicFingerprint("日本語")).toBe("日本語");
    const longestValidAliasTitle = "C#".repeat(120);
    expect(longestValidAliasTitle).toHaveLength(240);
    expect(exactTopicFingerprint(longestValidAliasTitle).length).toBeGreaterThan(
      240
    );
    expect(exactTopicFingerprint(longestValidAliasTitle).length).toBeLessThanOrEqual(
      1_024
    );

    const features = buildTopicNoveltyFeatures({
      title: "Adobe 2026: RAM & GPU!",
      angle: "Illustrator system requirements for design students.",
      sourceUrls: ["https://helpx.adobe.com/illustrator/requirements"],
    });
    expect(features.topicFingerprint).toBe("adobe 2026 ram gpu");
    expect(features.subjectKey).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("research source canonicalization", () => {
  it("removes tracking parameters while preserving meaningful query parameters", () => {
    expect(canonicalizeResearchUrl(OLD_ILLUSTRATOR_URL)).toBe(
      canonicalizeResearchUrl(NEW_ILLUSTRATOR_URL)
    );
    expect(
      canonicalizeResearchUrl(
        "https://example.com/search?utm_source=test&q=gpu&clearCache=123#results"
      )
    ).toBe("https://example.com/search?q=gpu");
    expect(canonicalizeResearchUrl("javascript:alert(1)")).toBeNull();
  });

  it("maps official documentation subdomains to stable source roots", () => {
    expect(researchRootDomain("https://helpx.adobe.com/a")).toBe("adobe.com");
    expect(researchRootDomain("learn.microsoft.com")).toBe("microsoft.com");
    expect(researchRootDomain("news.example.co.in")).toBe("example.co.in");
    expect(researchRootDomain("support.dell.com.mx")).toBe("dell.com.mx");
    expect(researchRootDomain("support.lenovo.com.mx")).toBe("lenovo.com.mx");
    expect(researchRootDomain("www.vendor.co.za")).toBe("vendor.co.za");
  });
});

describe("deterministic topic novelty", () => {
  it("rejects the two real Adobe packets despite their low title overlap", () => {
    const candidate = packet({
      title: NEW_ADOBE_TITLE,
      angle: NEW_ADOBE_ANGLE,
      summary: NEW_ADOBE_SUMMARY,
      urls: [
        NEW_ILLUSTRATOR_URL,
        "https://helpx.adobe.com/premiere/desktop/get-started/technical-requirements/adobe-premiere-pro-technical-requirements.html?clearCache=4e1a3af-fdb8-b9ee-74b0-368d2a7a679d",
        "https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information",
      ],
      confidence: 94,
    });
    const previous = reference({
      id: "old-adobe",
      title: OLD_ADOBE_TITLE,
      angle: OLD_ADOBE_ANGLE,
      summary: OLD_ADOBE_SUMMARY,
      audiences: ["design students"],
      sourceUrls: [
        "https://helpx.adobe.com/in/download-install/apps/system-requirements/creative-cloud-requirements.html",
        OLD_ILLUSTRATOR_URL,
      ],
    });

    const result = selectNovelResearchPackets({
      candidates: [candidate],
      references: [previous],
      audiences: ["design students"],
      policy: resolveResearchNoveltyPolicy(),
      now: NOW,
    });

    expect(result.packets).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]).toMatchObject({
      reason: "duplicate_topic",
      candidateTitle: NEW_ADOBE_TITLE,
      matchedId: "old-adobe",
      matchedTitle: OLD_ADOBE_TITLE,
    });
    expect(result.rejections[0].metrics.title).toBeLessThan(0.5);
    expect(result.rejections[0].metrics.url).toBe(1);
    expect(result.rejections[0].metrics.domain).toBe(1);
    expect(result.rejections[0].metrics.intent).toBeGreaterThan(0);
    expect(result.rejections[0].metrics.product).toBe(1);
    expect(result.rejections[0].metrics.audience).toBe(1);
    expect(result.rejections[0].metrics.similarity).toBeGreaterThanOrEqual(0.62);
    expect(result.rejections[0].similarityScore).toBeGreaterThanOrEqual(62);
    expect(result.summary).toMatchObject({
      primaryReason: "duplicate_topic",
      candidatesEvaluated: 1,
      candidatesAccepted: 0,
      rejectionCounts: { duplicate_topic: 1 },
      historyWindowDays: 180,
      similarityThreshold: 62,
    });
  });

  it("honors a higher admin cutoff for a non-exact semantic match", () => {
    const candidate = packet({
      title: "Illustrator laptop requirements for design student workflows",
      angle: "Explain Illustrator RAM and GPU requirements for coursework.",
      urls: ["https://adobe.com/illustrator/student-workflows"],
    });
    const previous = reference({
      id: "old-adobe",
      title: "Illustrator requirements for design students",
      angle: "Explain Illustrator memory and graphics requirements for coursework.",
      audiences: ["design students"],
      sourceUrls: ["https://adobe.com/illustrator/course-requirements"],
    });

    expect(
      selectNovelResearchPackets({
        candidates: [candidate],
        references: [previous],
        audiences: ["design students"],
        policy: { similarityThreshold: 0.62 },
        now: NOW,
      }).packets
    ).toHaveLength(0);
    expect(
      selectNovelResearchPackets({
        candidates: [candidate],
        references: [previous],
        audiences: ["design students"],
        policy: { similarityThreshold: 0.95 },
        now: NOW,
      }).packets
    ).toHaveLength(1);
  });

  it("uses dynamic source subjects for unlisted products such as Revit", () => {
    const sourceUrl =
      "https://help.autodesk.com/view/RVT/2026/ENU/?guid=Revit_System_Requirements";
    const previous = reference({
      id: "revit-reference",
      title: "Revit hardware guidance for architecture students",
      angle:
        "Explain Revit CPU RAM and graphics requirements for architecture coursework.",
      summary:
        "A practical overview of Autodesk Revit system requirements and smooth model workflows.",
      audiences: ["architecture students"],
      sourceUrls: [sourceUrl],
    });
    const candidate = packet({
      title: "Choosing a mobile workstation for BIM coursework",
      angle:
        "Translate Autodesk minimum and recommended specifications into laptop advice for student building models.",
      summary:
        "Help future architects choose enough memory processor and graphics capacity for BIM projects.",
      urls: [sourceUrl],
    });

    const result = selectNovelResearchPackets({
      candidates: [candidate],
      references: [previous],
      audiences: ["architecture students"],
      policy: resolveResearchNoveltyPolicy(),
      now: NOW,
    });

    expect(buildTopicNoveltyFeatures(previous).products).toContain("revit");
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0].similarityScore).toBeLessThan(62);
  });

  it("does not treat an unrelated Adobe policy topic as a duplicate", () => {
    const oldRequirements = reference({
      id: "old-adobe",
      title: OLD_ADOBE_TITLE,
      angle: OLD_ADOBE_ANGLE,
      summary: OLD_ADOBE_SUMMARY,
      audiences: ["design students"],
      sourceUrls: [OLD_ILLUSTRATOR_URL],
    });
    const cancellationPolicy = packet({
      title: "How Adobe subscription cancellation terms affect individual buyers",
      angle:
        "Explain cancellation windows, account billing terms, and support routes without discussing laptop specifications or software compatibility.",
      urls: ["https://www.adobe.com/legal/subscription-terms.html"],
      contentType: "trust-education",
    });

    const result = selectNovelResearchPackets({
      candidates: [cancellationPolicy],
      references: [oldRequirements],
      policy: resolveResearchNoveltyPolicy(),
      now: NOW,
    });

    expect(result.packets).toHaveLength(1);
    expect(result.rejections).toEqual([]);
    expect(result.packets[0].topicFingerprint).toBe(
      exactTopicFingerprint(cancellationPolicy.topicTitle)
    );
  });

  it("keeps the same requirements intent when the vendor and product differ", () => {
    const adobe = reference({
      id: "adobe",
      title: "Illustrator system requirements for design students",
      angle: "Explain Adobe Illustrator RAM and GPU requirements.",
      audiences: ["design students"],
      sourceUrls: [OLD_ILLUSTRATOR_URL],
    });
    const blender = packet({
      title: "Blender system requirements for design students",
      angle: "Explain Blender rendering memory and graphics requirements.",
      urls: ["https://www.blender.org/download/requirements/"],
    });

    expect(
      selectNovelResearchPackets({
        candidates: [blender],
        references: [adobe],
        policy: resolveResearchNoveltyPolicy(),
        now: NOW,
      }).packets
    ).toHaveLength(1);
  });

  it("blocks a matching manual blog title even when it has no research sources", () => {
    const blog = reference({
      id: "blog-1",
      kind: "blog_post",
      title: "How much RAM do design students need?",
      angle: "RAM for student design workflows",
      sourceUrls: [],
    });
    const candidate = packet({
      title: "How much RAM do design students need!",
      angle: "Explain RAM for student design workflows and multitasking.",
    });

    const result = selectNovelResearchPackets({
      candidates: [candidate],
      references: [blog],
      policy: resolveResearchNoveltyPolicy(),
      now: NOW,
    });

    expect(result.rejections[0]).toMatchObject({
      matchedId: "blog-1",
      matchedKind: "blog_post",
      similarityScore: 100,
    });
  });

  it("applies the history window and shorter rejected-topic window", () => {
    const candidate: NoveltyTopic = {
      title: "A repeated laptop research title",
      angle: "The same detailed editorial angle for a repeated topic.",
    };
    const at179Days: NoveltyTopic = {
      ...candidate,
      id: "179-days",
      kind: "research_packet",
      createdAt: new Date(NOW.getTime() - 179 * 86_400_000).toISOString(),
    };
    const at181Days: NoveltyTopic = {
      ...candidate,
      id: "181-days",
      kind: "research_packet",
      createdAt: new Date(NOW.getTime() - 181 * 86_400_000).toISOString(),
    };
    const rejected29Days: NoveltyTopic = {
      ...candidate,
      id: "rejected-29",
      kind: "research_packet",
      status: "rejected",
      createdAt: new Date(NOW.getTime() - 29 * 86_400_000).toISOString(),
    };
    const rejected31Days: NoveltyTopic = {
      ...candidate,
      id: "rejected-31",
      kind: "research_packet",
      status: "rejected",
      createdAt: new Date(NOW.getTime() - 31 * 86_400_000).toISOString(),
    };

    expect(
      evaluateTopicNovelty(candidate, [at179Days], { now: NOW }).novel
    ).toBe(false);
    expect(
      evaluateTopicNovelty(candidate, [at181Days], { now: NOW }).novel
    ).toBe(true);
    expect(
      evaluateTopicNovelty(candidate, [rejected29Days], { now: NOW }).novel
    ).toBe(false);
    expect(
      evaluateTopicNovelty(candidate, [rejected31Days], { now: NOW }).novel
    ).toBe(true);
  });

  it("keeps the higher-confidence candidate when a response contains duplicates", () => {
    const low: NoveltyTopic = {
      id: "low",
      title: "Adobe Illustrator requirements for design students",
      angle: "Explain Illustrator minimum hardware requirements.",
      sourceUrls: [OLD_ILLUSTRATOR_URL],
      confidenceScore: 80,
    };
    const high: NoveltyTopic = {
      id: "high",
      title: "Adobe Illustrator requirements for design students!",
      angle: "Explain Illustrator minimum hardware requirements.",
      sourceUrls: [NEW_ILLUSTRATOR_URL],
      confidenceScore: 95,
    };

    const result = evaluateTopicNoveltyBatch([low, high], [], { now: NOW });
    expect(result.accepted.map((topic) => topic.id)).toEqual(["high"]);
    expect(result.rejected[0]).toMatchObject({
      reason: "exact_title",
      matchedReference: { id: "high", kind: "current_batch" },
    });
  });

  it("stores accepted packet audit metadata only from durable history", () => {
    const historical = reference({
      id: "historical-blender",
      title: "Blender rendering requirements for animation students",
      angle: "Explain Blender memory and GPU needs for animation coursework.",
      audiences: ["animation students"],
      sourceUrls: ["https://blender.org/download/requirements/"],
    });
    const first = packet({
      title: "Illustrator requirements for design students",
      angle: "Explain Illustrator memory and GPU needs for design coursework.",
      urls: ["https://adobe.com/illustrator/requirements"],
      confidence: 95,
    });
    const second = packet({
      title: "Illustrator setup guidance for student portfolios",
      angle: "Explain Illustrator memory and graphics needs for design coursework.",
      urls: ["https://adobe.com/illustrator/setup"],
      confidence: 90,
    });

    const result = selectNovelResearchPackets({
      candidates: [first, second],
      references: [historical],
      audiences: ["design students"],
      policy: resolveResearchNoveltyPolicy({ similarityThreshold: 0.95 }),
      now: NOW,
    });

    expect(result.packets).toHaveLength(2);
    for (const accepted of result.packets) {
      expect(accepted.nearestTopicKind).toBe("research_packet");
      expect(accepted.nearestTopicId).toBe("historical-blender");
      expect(accepted.nearestTopicTitle).toBe(historical.title);
      expect(accepted.nearestTopicSimilarity).not.toBeNull();
      expect(accepted.noveltyScore).toBe(
        100 - (accepted.nearestTopicSimilarity ?? 0)
      );
    }
  });
});

describe("deterministic source rotation", () => {
  it("cools a majority source for the same calendar day and removes all subdomains", () => {
    const history = [
      reference({
        id: "adobe-packet",
        calendarDayId: "tuesday",
        scheduleRunId: "run-newest",
        createdAt: "2026-07-20T10:00:00.000Z",
        title: OLD_ADOBE_TITLE,
        sourceUrls: [
          OLD_ILLUSTRATOR_URL,
          "https://helpx.adobe.com/creative-cloud/system-requirements",
          "https://learn.microsoft.com/windows/release-health",
        ],
      }),
      reference({
        id: "blender-packet",
        calendarDayId: "tuesday",
        scheduleRunId: "run-previous",
        createdAt: "2026-07-19T10:00:00.000Z",
        title: "Blender requirements",
        sourceUrls: ["https://www.blender.org/download/requirements/"],
      }),
      reference({
        id: "different-day",
        calendarDayId: "monday",
        scheduleRunId: "run-other-day",
        createdAt: "2026-07-20T11:00:00.000Z",
        title: "Intel platform update",
        sourceUrls: ["https://intel.com/news/update"],
      }),
    ];
    const policy = resolveResearchNoveltyPolicy();

    expect(
      sourceRotationDomains({
        references: history,
        calendarDayId: "tuesday",
        policy,
        now: NOW,
      })
    ).toEqual(["adobe.com", "blender.org"]);

    expect(
      applySourceCooldown(
        ["helpx.adobe.com", "autodesk.com", "blender.org"],
        history
          .filter((item) => item.calendarDayId === "tuesday")
          .map((item) => ({
            runId: item.scheduleRunId ?? item.id,
            usedAt: item.createdAt,
            sourceUrls: item.sourceUrls ?? [],
          })),
        { policy, now: NOW }
      )
    ).toEqual({
      allowedDomains: ["autodesk.com"],
      cooledDomains: ["adobe.com", "blender.org"],
    });
  });

  it("does not cool an incidental one-of-three source or a run outside the last two", () => {
    const history = [
      reference({
        id: "newest",
        scheduleRunId: "run-3",
        createdAt: "2026-07-20T10:00:00.000Z",
        title: "Autodesk topic",
        sourceUrls: [
          "https://autodesk.com/a",
          "https://autodesk.com/b",
          "https://helpx.adobe.com/incidental",
        ],
      }),
      reference({
        id: "second",
        scheduleRunId: "run-2",
        createdAt: "2026-07-19T10:00:00.000Z",
        title: "Blender topic",
        sourceUrls: ["https://blender.org/a"],
      }),
      reference({
        id: "third",
        scheduleRunId: "run-1",
        createdAt: "2026-07-18T10:00:00.000Z",
        title: OLD_ADOBE_TITLE,
        sourceUrls: [OLD_ILLUSTRATOR_URL],
      }),
    ];

    expect(
      sourceRotationDomains({
        references: history,
        calendarDayId: "tuesday",
        policy: resolveResearchNoveltyPolicy(),
        now: NOW,
      })
    ).toEqual(["autodesk.com", "blender.org"]);
  });

  it("aggregates every packet in one run before choosing its dominant source", () => {
    expect(
      applySourceCooldown(
        ["adobe.com", "autodesk.com", "blender.org"],
        [
          {
            runId: "multi-packet-run",
            usedAt: "2026-07-20T10:00:00.000Z",
            sourceUrls: ["https://adobe.com/a", "https://autodesk.com/a"],
          },
          {
            runId: "multi-packet-run",
            usedAt: "2026-07-20T10:00:01.000Z",
            sourceUrls: ["https://autodesk.com/b"],
          },
        ],
        { now: NOW }
      )
    ).toEqual({
      allowedDomains: ["adobe.com", "blender.org"],
      cooledDomains: ["autodesk.com"],
    });
  });

  it("allows sources after 14 days and when source rotation is disabled", () => {
    const old = reference({
      id: "old",
      title: OLD_ADOBE_TITLE,
      createdAt: "2026-07-01T10:00:00.000Z",
      sourceUrls: [OLD_ILLUSTRATOR_URL],
    });

    expect(
      sourceRotationDomains({
        references: [old],
        calendarDayId: "tuesday",
        policy: resolveResearchNoveltyPolicy(),
        now: NOW,
      })
    ).toEqual([]);
    expect(
      sourceRotationDomains({
        references: [{ ...old, createdAt: "2026-07-20T10:00:00.000Z" }],
        calendarDayId: "tuesday",
        policy: { sourceRotationEnabled: false },
        now: NOW,
      })
    ).toEqual([]);
  });
});
