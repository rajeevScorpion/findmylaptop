// Builds the system prompt for the admin AI spec-extraction (the "Add Laptop"
// Fetch & Extract / Extract specs buttons). The objective spec fields and output
// format are identical across domains; only the *reasoning* fields (audience,
// course list, why/cautions/4-year/priority emphasis) change per domain, sourced
// from DOMAINS[domain].extraction and the live taxonomy. Used by both the
// fetch-amazon and process-laptop API routes so the prompt lives in one place.

import { DOMAINS, type DomainId } from "@/lib/domains";

/**
 * @param domain  Active domain selected in the admin form.
 * @param courses Flat list of the domain's programme names (taxonomy.allCourses).
 */
export function buildExtractionPrompt(domain: DomainId, courses: string[]): string {
  const e = DOMAINS[domain].extraction;
  const tagList = DOMAINS[domain].workloadTags.map((t) => `"${t.value}"`).join(", ");
  const courseLine =
    courses.length > 0
      ? `array of programme names from: [${courses.map((c) => `"${c}"`).join(", ")}]`
      : "array of programme names (no programmes are defined for this domain yet — return an empty array)";

  return `You are a laptop specification extraction assistant helping ${e.audience} choose the right laptop.

Extract structured laptop data from the provided raw text (Amazon product page, copy-pasted specifications, or product descriptions).

Return a JSON object with ONLY these fields (omit any field you cannot determine from the source):
- name: full product name
- brand: manufacturer name
- model: specific model name/number
- price_approx: approximate price as integer in INR (if mentioned)
- price_label: formatted price string like "₹89,990"
- cpu: full CPU name
- gpu: full GPU name (NVIDIA/AMD discrete GPU if present, otherwise integrated)
- gpu_vram_gb: GPU VRAM in GB as a number
- ram: RAM description like "16GB DDR5 5200MHz"
- ram_gb: RAM amount as integer
- storage: storage description like "512GB NVMe SSD"
- storage_gb: storage amount as integer
- display: display description including size, resolution, refresh rate, colour coverage
- weight: weight with unit like "2.2kg"
- os: operating system
- tier: one of "budget", "value", "balanced", "advanced", "premium" based on specs and price
- workload_tags: array of applicable tags from: [${tagList}]
- recommended_for_courses: ${courseLine}
- not_ideal_for: array of programme names this laptop is NOT suitable for
- why_recommended: 2-3 sentence student-friendly explanation of why this laptop suits this audience. ${e.whyFocus}
- cautions: honest limitations in 1-2 sentences. ${e.cautionsFocus}
- upgrade_notes: upgrade possibilities (RAM slots, M.2 slots) if known
- four_year_suitability: one of "basic", "good", "strong", "excellent" ${e.suitabilityBasis}
- priority_score: integer 0-100 reflecting overall recommendation strength for ${e.audience}

Rules:
- Extract only what is present or strongly inferable. Do not fabricate specific clock speeds or benchmark scores.
- Convert VRAM, RAM, and storage to numeric GB values.
- Be honest in cautions — students make multi-year purchasing decisions.
- Write why_recommended and cautions in plain, student-friendly language.
- Avoid marketing language.`;
}
