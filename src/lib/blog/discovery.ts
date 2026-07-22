import type { BlogCategory, BlogPost } from "./types";

export type BlogDiscoveryPost = Pick<
  BlogPost,
  | "id"
  | "title"
  | "slug"
  | "excerpt"
  | "reading_time_minutes"
  | "category_id"
  | "published_at"
>;

export type BlogTimeRange = "all" | "day" | "week" | "month" | "year";

export interface BlogDiscoveryFilters {
  query: string;
  categorySlug: string;
  timeRange: BlogTimeRange;
}

const RANGE_DAYS: Record<Exclude<BlogTimeRange, "all">, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-IN");
}

function publishedWithin(
  publishedAt: string | null,
  range: BlogTimeRange,
  now: Date
): boolean {
  if (range === "all") return true;
  if (!publishedAt) return false;

  const publishedTime = Date.parse(publishedAt);
  if (!Number.isFinite(publishedTime)) return false;

  const cutoff = now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  return publishedTime >= cutoff && publishedTime <= now.getTime();
}

function relevanceScore(
  post: BlogDiscoveryPost,
  categoryName: string,
  searchTerms: string[]
): number {
  const title = normalize(post.title);
  const excerpt = normalize(post.excerpt ?? "");
  const category = normalize(categoryName);

  return searchTerms.reduce((score, term) => {
    if (title.includes(term)) score += 6;
    if (category.includes(term)) score += 4;
    if (excerpt.includes(term)) score += 2;
    return score;
  }, 0);
}

export function filterBlogPosts(
  posts: BlogDiscoveryPost[],
  categories: BlogCategory[],
  filters: BlogDiscoveryFilters,
  now = new Date()
): BlogDiscoveryPost[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const selectedCategory = categories.find(
    (category) => category.slug === filters.categorySlug
  );
  const searchTerms = normalize(filters.query).trim().split(/\s+/).filter(Boolean);

  return posts
    .filter((post) => {
      if (selectedCategory && post.category_id !== selectedCategory.id) return false;
      if (!publishedWithin(post.published_at, filters.timeRange, now)) return false;
      if (searchTerms.length === 0) return true;

      const categoryName = categoryById.get(post.category_id ?? "")?.name ?? "";
      const searchableText = normalize(
        `${post.title} ${post.excerpt ?? ""} ${categoryName}`
      );
      return searchTerms.every((term) => searchableText.includes(term));
    })
    .map((post, index) => ({
      post,
      index,
      score: relevanceScore(
        post,
        categoryById.get(post.category_id ?? "")?.name ?? "",
        searchTerms
      ),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ post }) => post);
}

