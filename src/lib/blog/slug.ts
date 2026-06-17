// Slug + reading-time helpers for the blog/CMS.

import type { Block, BlogContentDoc } from "./types";

// Lowercase, hyphen-separated, punctuation stripped. SEO-friendly, not date-based.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD") // decompose accents; combining marks dropped by next step
    .replace(/[^a-z0-9\s-]/g, "") // drop punctuation and combining marks
    .trim()
    .replace(/[\s_-]+/g, "-") // collapse whitespace/underscores to single hyphen
    .replace(/^-+|-+$/g, "");
}

// Ensure uniqueness against a set of existing slugs by appending -2, -3, ...
export function uniqueSlug(base: string, existing: Set<string>): string {
  const slug = slugify(base) || "post";
  if (!existing.has(slug)) return slug;
  let n = 2;
  while (existing.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

// Rough word count across all text-bearing blocks → reading time in minutes.
function blockText(block: Block): string {
  switch (block.type) {
    case "hero":
      return `${block.data.title} ${block.data.excerpt ?? ""}`;
    case "heading":
      return block.text;
    case "paragraph":
      return block.text;
    case "bullets":
    case "numbered":
      return block.items.join(" ");
    case "card":
      return `${block.title ?? ""} ${block.content}`;
    case "callout":
      return `${block.title ?? ""} ${block.content}`;
    case "faq":
      return block.items.map((i) => `${i.question} ${i.answer}`).join(" ");
    case "cta":
      return `${block.title} ${block.body ?? ""}`;
    default:
      return "";
  }
}

export function readingTimeMinutes(doc: BlogContentDoc | null): number {
  if (!doc?.blocks?.length) return 1;
  const words = doc.blocks
    .map((b) => blockText(b as Block))
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
