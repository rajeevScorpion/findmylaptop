import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, CalendarDays } from "lucide-react";
import { getBlogFlags } from "@/lib/flags";
import { getPublishedPosts } from "@/lib/blog/queries";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Laptop Buying Guides & Tips — laptopfinder.cc",
  description:
    "Practical, jargon-free laptop buying guides for Indian students, parents, and professionals.",
  alternates: { canonical: "/blog" },
};

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function BlogIndexPage() {
  const flags = await getBlogFlags();
  if (!flags.blog_enabled || !flags.blog_public_enabled) {
    notFound();
  }

  const posts = await getPublishedPosts();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to LaptopFinder
        </Link>

        <header className="mb-10">
          <h1 className="text-3xl font-bold text-foreground">Laptop buying guides</h1>
          <p className="mt-2 text-muted-foreground">
            Simple, honest advice to help you choose the right laptop in India.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="glass-card rounded-2xl border p-8 text-center text-muted-foreground">
            No guides published yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="laptop-card glass-card rounded-2xl border p-5 flex flex-col gap-3 hover:border-border transition-colors"
              >
                <h2 className="text-base font-semibold text-foreground leading-snug">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                )}
                <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground pt-2">
                  {post.published_at && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {formatDate(post.published_at)}
                    </span>
                  )}
                  {post.reading_time_minutes ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {post.reading_time_minutes} min read
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
