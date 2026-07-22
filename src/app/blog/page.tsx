import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { getBlogFlags } from "@/lib/flags";
import { getPublicBlogCategories, getPublishedPosts } from "@/lib/blog/queries";
import { SiteHeader } from "@/components/public/SiteHeader";
import { BlogHero } from "@/components/blog/BlogHero";
import { BlogExplorer } from "@/components/blog/BlogExplorer";

export const metadata: Metadata = {
  title: "Laptop Buying Guides & Tips — laptopfinder.cc",
  description:
    "Practical, jargon-free laptop buying guides for Indian students, parents, and professionals.",
  alternates: { canonical: "/blog" },
};

export default async function BlogIndexPage() {
  "use cache";
  cacheTag("blog");
  cacheLife("hours");
  const flags = await getBlogFlags();
  if (!flags.blog_enabled || !flags.blog_public_enabled) {
    notFound();
  }

  const [posts, categories] = await Promise.all([
    getPublishedPosts(),
    getPublicBlogCategories(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero band — soft gradient spans behind both the nav and the hero */}
      <section className="relative w-full overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-6xl px-4 pt-16">
          <SiteHeader className="mb-7" />
        </div>

        <BlogHero />
      </section>

      {posts.length === 0 ? (
        <div className="mx-auto max-w-6xl px-4 pb-20">
          <div className="glass-card rounded-2xl border p-8 text-center text-muted-foreground">
            No guides published yet. Check back soon.
          </div>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="mx-auto max-w-7xl px-4 pb-20" aria-label="Loading article browser">
              <div className="glass-card h-28 animate-pulse rounded-2xl border" />
            </div>
          }
        >
          <BlogExplorer posts={posts} categories={categories} />
        </Suspense>
      )}
    </div>
  );
}
