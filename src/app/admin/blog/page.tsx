import { Plus, FileText } from "lucide-react";
import Link from "next/link";
import { getBlogFlags } from "@/lib/flags";
import { getAllPostsForAdmin } from "@/lib/blog/queries";
import type { BlogStatus } from "@/lib/blog/types";

const STATUS_STYLE: Record<BlogStatus, string> = {
  draft: "bg-muted/50 text-muted-foreground",
  ai_generated: "bg-primary/15 text-primary",
  review: "bg-amber-500/15 text-amber-500",
  published: "bg-emerald-500/15 text-emerald-500",
  archived: "bg-muted/40 text-muted-foreground line-through",
};

export default async function AdminBlogPage() {
  const flags = await getBlogFlags();

  if (!flags.blog_enabled) {
    return (
      <div className="glass-card rounded-2xl border p-8 text-center max-w-md mx-auto mt-10">
        <FileText className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
        <p className="text-foreground font-medium mb-1">Blog is disabled</p>
        <p className="text-sm text-muted-foreground">
          Enable the blog in <Link href="/admin/settings" className="underline">Settings</Link> to manage posts.
        </p>
      </div>
    );
  }

  const posts = await getAllPostsForAdmin();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-foreground">Blog</h1>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-1.5 rounded-[min(var(--radius-md),12px)] h-7 px-2.5 text-[0.8rem] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New post
        </Link>
        <Link
          href="/admin/personas"
          className="inline-flex items-center rounded-[min(var(--radius-md),12px)] h-7 px-2.5 text-[0.8rem] font-medium border border-border hover:bg-muted/40 transition-colors"
        >
          Author personas
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="glass-card rounded-2xl border p-8 text-center text-muted-foreground">
          No posts yet. Create your first one.
        </div>
      ) : (
        <div className="glass-card rounded-2xl border divide-y divide-border/30 overflow-hidden">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/admin/blog/${post.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                <p className="text-xs text-muted-foreground truncate">/{post.slug}</p>
              </div>
              <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${STATUS_STYLE[post.status] ?? ""}`}>
                {post.status.replace(/_/g, " ")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
