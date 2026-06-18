// Blog/CMS shared types. The content source of truth is `content_json`, a
// structured block document (see schemas.ts for runtime validation).

export type BlogStatus =
  | "draft"
  | "ai_generated"
  | "review"
  | "published"
  | "archived";

export type CalloutVariant = "info" | "warning" | "tip";

// ---- Content blocks --------------------------------------------------------

export interface HeroBlock {
  type: "hero";
  data: { title: string; excerpt?: string };
}

export interface HeadingBlock {
  type: "heading";
  level: 2 | 3;
  text: string;
  id: string; // anchor slug, used by the TOC
}

export interface ParagraphBlock {
  type: "paragraph";
  text: string;
}

export interface BulletsBlock {
  type: "bullets";
  items: string[];
}

export interface NumberedBlock {
  type: "numbered";
  items: string[];
}

export interface CardBlock {
  type: "card";
  variant?: string; // e.g. "quick_answer"
  icon?: string; // lucide icon name
  title?: string;
  content: string;
}

export interface CalloutBlock {
  type: "callout";
  variant: CalloutVariant;
  title?: string;
  content: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqBlock {
  type: "faq";
  items: FaqItem[];
}

export interface CtaBlock {
  type: "cta";
  variant?: string; // e.g. "finder"
  title: string;
  body?: string;
  href: string;
  label?: string;
}

// Future-ready: stores intent only, never hallucinated product data.
export interface ProductGridPlaceholderBlock {
  type: "product_grid_placeholder";
  data: { filterIntent?: string; limit?: number };
}

export type Block =
  | HeroBlock
  | HeadingBlock
  | ParagraphBlock
  | BulletsBlock
  | NumberedBlock
  | CardBlock
  | CalloutBlock
  | FaqBlock
  | CtaBlock
  | ProductGridPlaceholderBlock;

// Unknown/future block shape — the renderer must not crash on these.
export interface UnknownBlock {
  type: string;
  [key: string]: unknown;
}

export interface BlogContentDoc {
  type: "doc";
  blocks: Block[];
}

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

// ---- Post record (shape of a row from blog_posts) --------------------------

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content_json: BlogContentDoc | null;
  content_html: string | null;
  toc_json: TocEntry[] | null;
  schema_json: Record<string, unknown> | null;
  status: BlogStatus;
  template_type: string | null;
  audience: string[];
  primary_keyword: string | null;
  secondary_keywords: string[];
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  reading_time_minutes: number | null;
  category_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
  last_reviewed_at: string | null;
  needs_update_at: string | null;
  ai_inputs: AiInputs | null;
  created_at: string;
  updated_at: string;
}

// Persisted AI-panel inputs (column added in migration 015).
export interface AiInputs {
  topic?: string;
  brief?: string;
  sourceText?: string;
  targetLength?: "short" | "medium" | "long";
  audience?: string;
  template?: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
}
