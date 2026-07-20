import { blockSchema } from "@/lib/blog/schemas";
import type { BlogDraftQualityResult, BlogFactCheckItem } from "./types";

interface QualityInput {
  blocks: unknown[];
  researchConfidence: number;
  researchThreshold: number;
  blogThreshold: number;
  sourceCount: number;
  hasPersonaDisclosure: boolean;
}

function blockType(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("type" in value)) return null;
  return typeof value.type === "string" ? value.type : null;
}

function textFromBlock(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  return JSON.stringify(value);
}

function check(
  key: string,
  label: string,
  passed: boolean,
  detail: string,
  warning = false
): BlogFactCheckItem {
  return {
    key,
    label,
    status: passed ? "pass" : warning ? "warning" : "fail",
    detail,
  };
}

export function evaluateBlogDraftQuality(input: QualityInput): BlogDraftQualityResult {
  const validBlocks = input.blocks.filter((block) => blockSchema.safeParse(block).success);
  const types = input.blocks.map(blockType);
  const h2Count = input.blocks.filter(
    (block) =>
      blockType(block) === "heading" &&
      typeof block === "object" &&
      block !== null &&
      "level" in block &&
      block.level === 2
  ).length;
  const renderedText = input.blocks.map(textFromBlock).join(" ");
  const containsExactPrice =
    /(?:₹|\bINR\b|\bRs\.?\s*)\s*[\d,]+|\b(?:costs?|priced? at|price of)\s+[\d,]{3,}/i.test(
      renderedText
    );

  const checks: BlogFactCheckItem[] = [
    check(
      "research-confidence",
      "Research confidence gate",
      input.researchConfidence >= input.researchThreshold,
      `${input.researchConfidence}/100 against a ${input.researchThreshold}/100 threshold.`
    ),
    check(
      "source-evidence",
      "Source evidence attached",
      input.sourceCount > 0,
      `${input.sourceCount} verified source reference(s) are attached.`
    ),
    check(
      "block-validity",
      "Structured content is valid",
      input.blocks.length > 0 && validBlocks.length === input.blocks.length,
      `${validBlocks.length} of ${input.blocks.length} blocks match the CMS vocabulary.`
    ),
    check(
      "article-structure",
      "Required article structure",
      h2Count >= 3 && types.includes("faq") && types.includes("cta"),
      `${h2Count} H2 section(s); FAQ ${types.includes("faq") ? "present" : "missing"}; CTA ${
        types.includes("cta") ? "present" : "missing"
      }.`
    ),
    check(
      "persona-disclosure",
      "Persona disclosure available",
      input.hasPersonaDisclosure,
      input.hasPersonaDisclosure
        ? "A transparent author disclosure will render with the draft."
        : "The selected author has no usable public disclosure."
    ),
    check(
      "unsupported-price",
      "No unsupported exact price",
      !containsExactPrice,
      containsExactPrice
        ? "The generated draft contains an exact price and requires manual evidence review."
        : "No exact price pattern was detected in generated content."
    ),
    check(
      "source-depth",
      "Source depth",
      input.sourceCount >= 2,
      input.sourceCount >= 2
        ? "The packet uses more than one verified source."
        : "A single-source topic should receive additional admin scrutiny.",
      true
    ),
  ];

  const structureScore = Math.min(25, h2Count * 5 + (types.includes("faq") ? 5 : 0) + (types.includes("cta") ? 5 : 0));
  const evidenceScore = Math.min(35, Math.max(0, input.researchConfidence) * 0.35);
  const validityScore = input.blocks.length
    ? (validBlocks.length / input.blocks.length) * 20
    : 0;
  const safetyScore = containsExactPrice ? 0 : 10;
  const disclosureScore = input.hasPersonaDisclosure ? 10 : 0;
  const score = Math.round(
    Math.min(100, evidenceScore + structureScore + validityScore + safetyScore + disclosureScore)
  );
  const hasFailure = checks.some((item) => item.status === "fail");
  return {
    score,
    passed: !hasFailure && score >= input.blogThreshold,
    checks,
  };
}
