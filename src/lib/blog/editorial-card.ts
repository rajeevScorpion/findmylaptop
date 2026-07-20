function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function generatedEditorialDisclosure(value: unknown): string | null {
  if (!isRecord(value) || value.type !== "callout") return null;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!/^(?:ai\s+)?editorial disclosure$/i.test(title)) return null;
  return typeof value.content === "string" ? value.content.trim() : "";
}

function isFaqBlock(value: unknown): boolean {
  return isRecord(value) && value.type === "faq";
}

export interface EditorialCardPlacement {
  beforeCard: unknown[];
  afterCard: unknown[];
  generatedDisclosure: string | null;
}

/**
 * Remove generated disclosure callouts and create a slot immediately after the
 * last FAQ. If an article has no FAQ, the combined editorial card goes at the
 * end of its content.
 */
export function placeEditorialCardAfterFaq(
  blocks: readonly unknown[]
): EditorialCardPlacement {
  const articleBlocks: unknown[] = [];
  const disclosures = new Set<string>();

  for (const block of blocks) {
    const disclosure = generatedEditorialDisclosure(block);
    if (disclosure !== null) {
      if (disclosure) disclosures.add(disclosure);
      continue;
    }
    articleBlocks.push(block);
  }

  let lastFaqIndex = -1;
  articleBlocks.forEach((block, index) => {
    if (isFaqBlock(block)) lastFaqIndex = index;
  });
  const splitIndex = lastFaqIndex >= 0 ? lastFaqIndex + 1 : articleBlocks.length;

  return {
    beforeCard: articleBlocks.slice(0, splitIndex),
    afterCard: articleBlocks.slice(splitIndex),
    generatedDisclosure: disclosures.size
      ? [...disclosures].join("\n\n")
      : null,
  };
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function combineEditorialDisclosure(
  personaDisclosure: string,
  generatedDisclosure?: string | null
): string {
  const persona = personaDisclosure.trim();
  const generated = generatedDisclosure?.trim() ?? "";
  if (!generated) return persona;
  if (!persona || normalized(generated).includes(normalized(persona))) {
    return generated;
  }
  return `${persona}\n\n${generated}`;
}
