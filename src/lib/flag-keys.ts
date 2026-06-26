// Client-safe flag type/constant definitions. No server imports.
// flags.ts (server-only) imports from here; client components import from here directly.

export type BlogFlagKey =
  | "blog_enabled"
  | "blog_public_enabled"
  | "ai_blog_writer_enabled"
  | "blog_product_blocks_enabled"
  | "blog_schema_enabled"
  | "blog_auto_sitemap_enabled";

export type BlogFlags = Record<BlogFlagKey, boolean>;

export const BLOG_FLAG_KEYS: BlogFlagKey[] = [
  "blog_enabled",
  "blog_public_enabled",
  "ai_blog_writer_enabled",
  "blog_product_blocks_enabled",
  "blog_schema_enabled",
  "blog_auto_sitemap_enabled",
];

export type DomainFlagKey = "domain_tech_enabled" | "domain_mgmt_enabled";

export type DomainFlags = Record<DomainFlagKey, boolean>;

export const DOMAIN_FLAG_KEYS: DomainFlagKey[] = [
  "domain_tech_enabled",
  "domain_mgmt_enabled",
];
