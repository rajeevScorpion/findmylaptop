import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getBlogFlags } from "@/lib/flags";
import { getCategories, getPostByIdForAdmin } from "@/lib/blog/queries";
import { getPersonaOptionsForAdmin } from "@/lib/personas/service";
import { BlogPostForm } from "@/components/admin/blog/BlogPostForm";

type Props = { params: Promise<{ id: string }> };

export default async function AdminEditBlogPostPage({ params }: Props) {
  const flags = await getBlogFlags();
  if (!flags.blog_enabled) redirect("/admin/blog");

  const { id } = await params;
  const post = await getPostByIdForAdmin(id);
  if (!post) notFound();

  const [categories, personas] = await Promise.all([
    getCategories(),
    // Keep the legacy editor usable during the deploy window before the user
    // manually applies migration 027.
    getPersonaOptionsForAdmin().catch(() => []),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <a href="/admin/blog" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ChevronLeft className="w-3 h-3" />
          Back to blog
        </a>
        <h1 className="text-xl font-bold text-foreground">Edit post</h1>
      </div>
      <BlogPostForm
        post={post}
        categories={categories}
        personas={personas}
        aiWriterEnabled={flags.ai_blog_writer_enabled}
        productBlocksEnabled={flags.blog_product_blocks_enabled}
      />
    </div>
  );
}
