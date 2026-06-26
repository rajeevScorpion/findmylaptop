import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BlogCategory, BlogPost } from "./types";

// Server-only blog data access. Uses the service-role client (like the laptop
// detail page) and filters by status in code, so public pages only ever expose
// published rows.

const LIST_COLUMNS =
  "id, title, slug, excerpt, status, reading_time_minutes, category_id, primary_keyword, published_at, updated_at, og_image_url";

const FULL_COLUMNS = "*";

export async function getPublishedPosts(): Promise<BlogPost[]> {
  "use cache";
  cacheTag("blog");
  cacheLife("hours");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return (data ?? []) as BlogPost[];
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  "use cache";
  cacheTag("blog");
  cacheLife("hours");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(FULL_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as BlogPost) ?? null;
}

export async function getRelatedPosts(
  post: Pick<BlogPost, "id" | "category_id">,
  limit = 3
): Promise<BlogPost[]> {
  "use cache";
  cacheTag("blog");
  cacheLife("hours");
  const supabase = createAdminClient();
  let query = supabase
    .from("blog_posts")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .neq("id", post.id)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (post.category_id) query = query.eq("category_id", post.category_id);
  const { data } = await query;
  return (data ?? []) as BlogPost[];
}

// Slugs only — used by the sitemap.
export async function getPublishedPostSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  "use cache";
  cacheTag("blog");
  cacheLife("hours");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("status", "published");
  return (data ?? []) as { slug: string; updated_at: string }[];
}

// ---- Admin ----------------------------------------------------------------
// No caching on admin functions — they need to be always fresh.

export async function getAllPostsForAdmin(): Promise<BlogPost[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(`${LIST_COLUMNS}, created_at`)
    .order("updated_at", { ascending: false });
  return (data ?? []) as unknown as BlogPost[];
}

export async function getPostByIdForAdmin(id: string): Promise<BlogPost | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(FULL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as BlogPost) ?? null;
}

export async function getCategories(): Promise<BlogCategory[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_categories")
    .select("id, name, slug, description")
    .order("name", { ascending: true });
  return (data ?? []) as BlogCategory[];
}

export async function getExistingSlugs(): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("blog_posts").select("slug");
  return new Set((data ?? []).map((r: { slug: string }) => r.slug));
}
