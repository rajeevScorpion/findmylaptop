"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Clock,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import {
  filterBlogPosts,
  type BlogDiscoveryPost,
  type BlogTimeRange,
} from "@/lib/blog/discovery";
import type { BlogCategory } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

interface BlogExplorerProps {
  posts: BlogDiscoveryPost[];
  categories: BlogCategory[];
}

const TIME_OPTIONS: { value: BlogTimeRange; label: string; shortLabel: string }[] = [
  { value: "all", label: "Any time", shortLabel: "Any time" },
  { value: "day", label: "Past 24 hours", shortLabel: "24 hours" },
  { value: "week", label: "Past 7 days", shortLabel: "7 days" },
  { value: "month", label: "Past 30 days", shortLabel: "30 days" },
  { value: "year", label: "Past year", shortLabel: "Past year" },
];

const VALID_TIME_RANGES = new Set<BlogTimeRange>(
  TIME_OPTIONS.map((option) => option.value)
);

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function readInitialFilters(
  categories: BlogCategory[],
  params: Pick<URLSearchParams, "get">
) {
  const requestedCategory = params.get("category") ?? "";
  const requestedTime = params.get("when") as BlogTimeRange | null;

  return {
    query: (params.get("q") ?? "").slice(0, 120),
    categorySlug: categories.some((category) => category.slug === requestedCategory)
      ? requestedCategory
      : "",
    timeRange:
      requestedTime && VALID_TIME_RANGES.has(requestedTime) ? requestedTime : "all",
  };
}

function FilterControls({
  posts,
  categories,
  categorySlug,
  timeRange,
  onCategoryChange,
  onTimeChange,
}: {
  posts: BlogDiscoveryPost[];
  categories: BlogCategory[];
  categorySlug: string;
  timeRange: BlogTimeRange;
  onCategoryChange: (slug: string) => void;
  onTimeChange: (range: BlogTimeRange) => void;
}) {
  const countsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      if (post.category_id) {
        counts.set(post.category_id, (counts.get(post.category_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [posts]);

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Tag className="size-4 text-primary" aria-hidden="true" />
          Topics
        </legend>
        <div className="space-y-1.5">
          <button
            type="button"
            aria-pressed={categorySlug === ""}
            onClick={() => onCategoryChange("")}
            className={cn(
              "flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              categorySlug === ""
                ? "bg-primary/12 font-semibold text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>All topics</span>
            <span className="text-xs tabular-nums" aria-label={`${posts.length} articles`}>
              {posts.length}
            </span>
          </button>
          {categories.map((category) => {
            const count = countsByCategory.get(category.id) ?? 0;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={categorySlug === category.slug}
                onClick={() => onCategoryChange(category.slug)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  categorySlug === category.slug
                    ? "bg-primary/12 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{category.name}</span>
                <span className="text-xs tabular-nums" aria-label={`${count} articles`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          Published
        </legend>
        <div className="relative space-y-1.5 before:absolute before:bottom-5 before:left-[1.075rem] before:top-5 before:w-px before:bg-border">
          {TIME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={timeRange === option.value}
              onClick={() => onTimeChange(option.value)}
              className={cn(
                "relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                timeRange === option.value
                  ? "bg-primary/12 font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "relative z-10 size-2.5 shrink-0 rounded-full border-2 bg-background",
                  timeRange === option.value ? "border-primary bg-primary" : "border-border"
                )}
                aria-hidden="true"
              />
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function BlogExplorer({ posts, categories }: BlogExplorerProps) {
  const visibleCategories = useMemo(() => {
    const usedCategoryIds = new Set(posts.map((post) => post.category_id).filter(Boolean));
    return categories.filter((category) => usedCategoryIds.has(category.id));
  }, [categories, posts]);
  const searchParams = useSearchParams();
  const initialFilters = useMemo(
    () => readInitialFilters(visibleCategories, searchParams),
    [searchParams, visibleCategories]
  );
  const [query, setQuery] = useState(initialFilters.query);
  const [categorySlug, setCategorySlug] = useState(initialFilters.categorySlug);
  const [timeRange, setTimeRange] = useState<BlogTimeRange>(initialFilters.timeRange);
  const [now] = useState(() => new Date());
  const deferredQuery = useDeferredValue(query);

  const filteredPosts = useMemo(
    () =>
      filterBlogPosts(
        posts,
        visibleCategories,
        { query: deferredQuery, categorySlug, timeRange },
        now
      ),
    [categorySlug, deferredQuery, now, posts, timeRange, visibleCategories]
  );

  const categoryById = useMemo(
    () => new Map(visibleCategories.map((category) => [category.id, category])),
    [visibleCategories]
  );
  const selectedCategory = visibleCategories.find(
    (category) => category.slug === categorySlug
  );
  const selectedTime = TIME_OPTIONS.find((option) => option.value === timeRange);
  const activeFilterCount = Number(Boolean(query.trim())) + Number(Boolean(categorySlug)) + Number(timeRange !== "all");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const cleanQuery = query.trim();

      if (cleanQuery) url.searchParams.set("q", cleanQuery);
      else url.searchParams.delete("q");
      if (categorySlug) url.searchParams.set("category", categorySlug);
      else url.searchParams.delete("category");
      if (timeRange !== "all") url.searchParams.set("when", timeRange);
      else url.searchParams.delete("when");

      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [categorySlug, query, timeRange]);

  function resetFilters() {
    setQuery("");
    setCategorySlug("");
    setTimeRange("all");
  }

  return (
    <section aria-labelledby="blog-explorer-heading" className="px-4 pb-20">
      <div className="mx-auto max-w-7xl">
        <div className="glass-card mb-6 rounded-2xl border p-4 shadow-sm sm:p-5">
          <form role="search" onSubmit={(event) => event.preventDefault()}>
            <div className="mb-2 flex items-end justify-between gap-4">
              <div>
                <label id="blog-explorer-heading" htmlFor="blog-search" className="font-semibold">
                  Search articles
                </label>
                <p id="blog-search-help" className="mt-0.5 text-sm text-muted-foreground">
                  Search titles, descriptions, and topics.
                </p>
              </div>
            </div>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="blog-search"
                type="search"
                value={query}
                maxLength={120}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try ‘student laptop’, ‘RAM’, or ‘budget’"
                aria-describedby="blog-search-help"
                className="min-h-12 w-full rounded-xl border bg-background py-3 pl-12 pr-12 text-base outline-none transition-shadow placeholder:text-muted-foreground/75 focus:border-ring focus:ring-3 focus:ring-ring/30"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </form>
        </div>

        <details className="glass-card group mb-6 rounded-2xl border lg:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
              Filter articles
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t p-4">
            <FilterControls
              posts={posts}
              categories={visibleCategories}
              categorySlug={categorySlug}
              timeRange={timeRange}
              onCategoryChange={setCategorySlug}
              onTimeChange={setTimeRange}
            />
          </div>
        </details>

        <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside aria-label="Article filters" className="hidden lg:block">
            <div className="glass-card sticky top-6 rounded-2xl border p-4">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-semibold">
                  <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
                  Filters
                </h2>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="min-h-11 rounded-lg px-2 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <FilterControls
                posts={posts}
                categories={visibleCategories}
                categorySlug={categorySlug}
                timeRange={timeRange}
                onCategoryChange={setCategorySlug}
                onTimeChange={setTimeRange}
              />
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="blog-results-heading" className="text-xl font-bold">
                  Latest guides
                </h2>
                <p className="mt-1 text-sm text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
                  {filteredPosts.length} {filteredPosts.length === 1 ? "article" : "articles"} found
                </p>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="min-h-11 rounded-xl border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {activeFilterCount > 0 && (
              <div className="mb-5 flex flex-wrap gap-2" aria-label="Active filters">
                {query.trim() && (
                  <button type="button" onClick={() => setQuery("")} className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border bg-background px-3 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className="max-w-52 truncate">Search: {query.trim()}</span>
                    <X className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Remove search filter</span>
                  </button>
                )}
                {selectedCategory && (
                  <button type="button" onClick={() => setCategorySlug("")} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border bg-background px-3 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    {selectedCategory.name}
                    <X className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Remove topic filter</span>
                  </button>
                )}
                {timeRange !== "all" && selectedTime && (
                  <button type="button" onClick={() => setTimeRange("all")} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border bg-background px-3 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    {selectedTime.shortLabel}
                    <X className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Remove date filter</span>
                  </button>
                )}
              </div>
            )}

            {filteredPosts.length === 0 ? (
              <div className="glass-card rounded-2xl border px-6 py-14 text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                  <Search className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold">No matching guides</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Try a broader search, another topic, or a wider publishing range.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Show all articles
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2" aria-labelledby="blog-results-heading">
                {filteredPosts.map((post) => {
                  const category = categoryById.get(post.category_id ?? "");
                  return (
                    <article
                      key={post.id}
                      className="glass-card group relative flex min-h-64 flex-col rounded-2xl border p-5 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
                    >
                      {category && (
                        <span className="mb-3 w-fit rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-foreground">
                          {category.name}
                        </span>
                      )}
                      <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      {post.excerpt && (
                        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {post.published_at && (
                            <time dateTime={post.published_at} className="inline-flex items-center gap-1.5">
                              <CalendarDays className="size-3.5" aria-hidden="true" />
                              {formatDate(post.published_at)}
                            </time>
                          )}
                          {post.reading_time_minutes ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="size-3.5" aria-hidden="true" />
                              {post.reading_time_minutes} min read
                            </span>
                          ) : null}
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary" aria-hidden="true">
                          Read guide
                          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
