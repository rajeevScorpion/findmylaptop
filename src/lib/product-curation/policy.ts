import type {
  CatalogAudit,
  CatalogCourseSnapshot,
  CatalogLaptopSnapshot,
  CatalogPolicyFinding,
  CompiledHardwarePolicy,
  CompiledRulebook,
} from "./types";
import type { DomainId } from "@/lib/domains";

function normalized(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function laptopFingerprint(laptop: CatalogLaptopSnapshot): string {
  return [
    normalized(laptop.brand),
    normalized(laptop.model || laptop.name),
    laptop.ram_gb ?? "?",
    laptop.storage_gb ?? "?",
    normalized(laptop.gpu),
  ].join("|");
}

function parseWeightKg(value: string | null): number | null {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*kg/i);
  return match ? Number(match[1]) : null;
}

function includesAny(haystack: string, terms: readonly string[]): boolean {
  return terms.length === 0 || terms.some((term) => haystack.includes(normalized(term)));
}

export function evaluateLaptopPolicy(
  laptop: CatalogLaptopSnapshot,
  policy: CompiledHardwarePolicy
): { pass: boolean; reasons: string[]; score: number } {
  const reasons: string[] = [];
  let checks = 0;
  let passed = 0;
  const check = (condition: boolean, failure: string) => {
    checks += 1;
    if (condition) passed += 1;
    else reasons.push(failure);
  };
  if (policy.minimumRamGb !== null) {
    check((laptop.ram_gb ?? 0) >= policy.minimumRamGb, `RAM is below ${policy.minimumRamGb} GB.`);
  }
  if (policy.minimumStorageGb !== null) {
    check((laptop.storage_gb ?? 0) >= policy.minimumStorageGb, `Storage is below ${policy.minimumStorageGb} GB.`);
  }
  if (policy.minimumGpuVramGb !== null) {
    check((laptop.gpu_vram_gb ?? 0) >= policy.minimumGpuVramGb, `GPU memory is below ${policy.minimumGpuVramGb} GB.`);
  }
  if (policy.requiresDedicatedGpu !== null) {
    const gpu = normalized(laptop.gpu);
    const dedicated = Boolean(gpu && !/(integrated|iris|uhd|radeon graphics)/.test(gpu));
    check(dedicated === policy.requiresDedicatedGpu, policy.requiresDedicatedGpu ? "A dedicated GPU is required." : "Specialist dedicated graphics are unnecessary for this policy.");
  }
  if (policy.maximumWeightKg !== null) {
    const weight = parseWeightKg(laptop.weight);
    check(weight !== null && weight <= policy.maximumWeightKg, `Weight is unknown or above ${policy.maximumWeightKg} kg.`);
  }
  if (policy.requiredCpuTerms.length) {
    check(includesAny(normalized(laptop.cpu), policy.requiredCpuTerms), "CPU family does not match the rulebook.");
  }
  if (policy.requiredGpuTerms.length) {
    check(includesAny(normalized(laptop.gpu), policy.requiredGpuTerms), "GPU family does not match the rulebook.");
  }
  const searchable = normalized([laptop.name, laptop.cpu, laptop.gpu, laptop.display].join(" "));
  const avoided = policy.avoidTerms.find((term) => searchable.includes(normalized(term)));
  if (avoided) {
    checks += 1;
    reasons.push(`Matches excluded term: ${avoided}.`);
  }
  const score = checks === 0 ? 75 : Math.round((passed / checks) * 100);
  return { pass: reasons.length === 0, reasons, score };
}

export function policyForCourse(rulebook: CompiledRulebook, courseName: string) {
  return rulebook.coursePolicies.find(
    (entry) => normalized(entry.courseName) === normalized(courseName)
  )?.hardware ?? rulebook.generalHardware;
}

export function auditCatalog(input: {
  domain: DomainId;
  rulebook: CompiledRulebook;
  courses: CatalogCourseSnapshot[];
  laptops: CatalogLaptopSnapshot[];
  pendingCandidateCount: number;
  maxDomainRecommendations: number;
  maxCourseRecommendations: number;
}): CatalogAudit {
  const published = input.laptops.filter((laptop) => laptop.is_published);
  const findings: CatalogPolicyFinding[] = [];
  const target = Math.min(
    input.rulebook.targetRecommendationsPerCourse,
    input.maxCourseRecommendations
  );
  const gaps = input.courses.map((course) => {
    const assigned = published.filter((laptop) =>
      laptop.recommended_for_courses.includes(course.name)
    );
    for (const laptop of assigned) {
      const evaluation = evaluateLaptopPolicy(
        laptop,
        policyForCourse(input.rulebook, course.name)
      );
      findings.push({
        laptopId: laptop.id,
        laptopName: laptop.name,
        courseId: course.id,
        courseName: course.name,
        decision: evaluation.pass ? "keep" : "remove",
        reasons: evaluation.pass ? ["Meets the current rulebook."] : evaluation.reasons,
        score: evaluation.score,
      });
    }
    const validCount = assigned.filter((laptop) =>
      evaluateLaptopPolicy(laptop, policyForCourse(input.rulebook, course.name)).pass
    ).length;
    const initialMissingCount = Math.max(0, target - validCount);
    let reusableCount = 0;
    if (initialMissingCount > 0) {
      const reusable = published
        .filter((laptop) => !laptop.recommended_for_courses.includes(course.name))
        .map((laptop) => ({
          laptop,
          evaluation: evaluateLaptopPolicy(
            laptop,
            policyForCourse(input.rulebook, course.name)
          ),
        }))
        .filter(({ evaluation }) => evaluation.pass)
        .sort((left, right) =>
          right.evaluation.score - left.evaluation.score ||
          right.laptop.priority_score - left.laptop.priority_score
        )
        .slice(0, initialMissingCount);
      reusableCount = reusable.length;
      reusable.forEach(({ laptop, evaluation }) => {
          findings.push({
            laptopId: laptop.id,
            laptopName: laptop.name,
            courseId: course.id,
            courseName: course.name,
            decision: "add",
            reasons: ["Existing catalog laptop satisfies the rulebook and fills this course gap."],
            score: evaluation.score,
          });
      });
    }
    const afterPublishedReuse = Math.max(0, initialMissingCount - reusableCount);
    let unpublishedReuseCount = 0;
    if (afterPublishedReuse > 0) {
      const reusableDrafts = input.laptops
        .filter((laptop) => !laptop.is_published)
        .map((laptop) => ({
          laptop,
          evaluation: evaluateLaptopPolicy(laptop, policyForCourse(input.rulebook, course.name)),
        }))
        .filter(({ evaluation }) => evaluation.pass)
        .sort((left, right) =>
          right.evaluation.score - left.evaluation.score ||
          right.laptop.priority_score - left.laptop.priority_score
        )
        .slice(0, afterPublishedReuse);
      unpublishedReuseCount = reusableDrafts.length;
      for (const { laptop, evaluation } of reusableDrafts) {
        if (!laptop.recommended_for_courses.includes(course.name)) {
          findings.push({
            laptopId: laptop.id,
            laptopName: laptop.name,
            courseId: course.id,
            courseName: course.name,
            decision: "add",
            reasons: ["This unpublished catalog laptop satisfies the rulebook; add the course mapping before publication review."],
            score: evaluation.score,
          });
        }
        findings.push({
          laptopId: laptop.id,
          laptopName: laptop.name,
          courseId: null,
          courseName: course.name,
          decision: "review",
          reasons: [`An existing unpublished laptop can fill the ${course.name} gap after final admin review.`],
          score: evaluation.score,
        });
      }
    }
    const missingCount = Math.max(0, afterPublishedReuse - unpublishedReuseCount);
    return {
      courseId: course.id,
      courseName: course.name,
      currentCount: validCount,
      targetCount: target,
      missingCount,
    };
  });
  const fingerprints = input.laptops.map(laptopFingerprint);
  const knownFingerprints = [...new Set(fingerprints)];
  const duplicateFingerprints = [...new Set(fingerprints.filter(
    (value, index) => fingerprints.indexOf(value) !== index
  ))];
  const hasGap = gaps.some((gap) => gap.missingCount > 0);
  const catalogHasRoom = published.length < input.maxDomainRecommendations;
  const searchAllowed = hasGap && catalogHasRoom && input.pendingCandidateCount < 3;
  const searchReason = !hasGap
    ? "Every active course has enough valid recommendations."
    : !catalogHasRoom
      ? "The domain recommendation cap is already reached; improve or replace existing entries first."
      : input.pendingCandidateCount >= 3
        ? "The pending candidate queue already contains enough decisions for this domain."
        : "The catalog has a verified coverage gap and room for a curated candidate.";
  return {
    domain: input.domain,
    publishedCount: published.length,
    unpublishedCount: input.laptops.length - published.length,
    pendingCandidateCount: input.pendingCandidateCount,
    gaps,
    findings,
    knownAsins: [...new Set(input.laptops.flatMap((laptop) => laptop.asin ? [laptop.asin.toUpperCase()] : []))],
    knownFingerprints,
    duplicateFingerprints,
    searchAllowed,
    searchReason,
  };
}
