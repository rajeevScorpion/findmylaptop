import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, CalendarDays } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import { getBlogFlags } from "@/lib/flags";
import { getPublishedPosts } from "@/lib/blog/queries";
import { getAllPublishedLaptops, getPublicSettings } from "@/lib/laptop-queries";
import { SiteHeader } from "@/components/public/SiteHeader";
import { WhatsAppCTA } from "@/components/public/WhatsAppCTA";
import { ChatWidgetLoader } from "@/components/public/ChatWidgetLoader";
import { BlogHero } from "@/components/blog/BlogHero";
import { ShareButton } from "@/components/blog/ShareButton";


const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://laptopfinder.cc";

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
  "use cache";
  cacheTag("blog");
  cacheLife("hours");
  const flags = await getBlogFlags();
  if (!flags.blog_enabled || !flags.blog_public_enabled) {
    notFound();
  }

  const [posts, laptops, settingsMap] = await Promise.all([
    getPublishedPosts(),
    getAllPublishedLaptops(),
    getPublicSettings(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero band — soft gradient spans behind both the nav and the hero */}
      <section className="relative w-full overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 px-4 pt-16 max-w-6xl mx-auto">
          <SiteHeader className="mb-10" />
        </div>

        <BlogHero />
      </section>

      <div className="px-4 pb-20 max-w-6xl mx-auto">
        {posts.length === 0 ? (
          <div className="glass-card rounded-2xl border p-8 text-center text-muted-foreground">
            No guides published yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {posts.map((post) => (
              <div
                key={post.id}
                className="laptop-card glass-card rounded-2xl border p-5 flex flex-col gap-3 hover:border-border transition-colors relative"
              >
                {/* Stretched overlay link makes the whole card clickable */}
                <Link
                  href={`/blog/${post.slug}`}
                  aria-label={post.title}
                  className="absolute inset-0 rounded-2xl"
                />

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
                  <ShareButton
                    url={`${SITE_URL}/blog/${post.slug}`}
                    title={post.title}
                    className="relative z-10 ml-auto"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <WhatsAppCTA whatsappUrl={settingsMap["whatsapp_url"]} variant="floating" />
      <ChatWidgetLoader laptops={laptops} voiceEnabled={settingsMap["voice_input_enabled"] !== "false"} />
    </div>
  );
}
