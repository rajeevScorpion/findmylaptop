// Derive a table-of-contents from heading blocks in a content doc.

import type { Block, BlogContentDoc, TocEntry } from "./types";
import { slugify } from "./slug";

export function buildToc(doc: BlogContentDoc | null): TocEntry[] {
  if (!doc?.blocks?.length) return [];
  const seen = new Set<string>();
  const toc: TocEntry[] = [];

  for (const raw of doc.blocks) {
    const block = raw as Block;
    if (block.type !== "heading") continue;
    const level = block.level === 3 ? 3 : 2;
    let id = block.id?.trim() || slugify(block.text);
    if (!id) continue;
    // Guarantee unique anchor ids
    let unique = id;
    let n = 2;
    while (seen.has(unique)) unique = `${id}-${n++}`;
    seen.add(unique);
    id = unique;
    toc.push({ id, text: block.text, level });
  }
  return toc;
}

// Apply the (possibly de-duplicated) ids back onto heading blocks so the
// rendered anchors match the TOC links exactly.
export function syncHeadingIds(doc: BlogContentDoc): BlogContentDoc {
  const toc = buildToc(doc);
  let ti = 0;
  const blocks = doc.blocks.map((raw) => {
    const block = raw as Block;
    if (block.type === "heading") {
      const entry = toc[ti++];
      if (entry) return { ...block, id: entry.id };
    }
    return raw;
  });
  return { ...doc, blocks: blocks as Block[] };
}
