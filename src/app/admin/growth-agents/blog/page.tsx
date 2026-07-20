import { Suspense } from "react";
import { FilePenLine } from "lucide-react";
import { requireAdmin } from "@/lib/admin/authorization";
import {
  listBlogAgentDrafts,
  listBloggableResearchPackets,
} from "@/lib/blog-agent/service";
import { getPersonaOptionsForAdmin } from "@/lib/personas/service";
import { BlogDraftQueue } from "@/components/admin/growth-agents/BlogDraftQueue";

async function BlogDraftContent() {
  await requireAdmin();
  try {
    const [packets, artifacts, personas] = await Promise.all([
      listBloggableResearchPackets(),
      listBlogAgentDrafts(),
      getPersonaOptionsForAdmin(),
    ]);
    return (
      <BlogDraftQueue
        initialPackets={packets}
        initialArtifacts={artifacts}
        personas={personas.filter(
          (persona) =>
            persona.status === "active" && persona.permissions.canWriteBlogs
        )}
      />
    );
  } catch (error) {
    return (
      <div className="glass-card rounded-xl border border-amber-500/30 p-5 space-y-2">
        <p className="text-sm font-medium text-foreground">
          Blogging Agent queue is not available yet
        </p>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "Apply migrations 024-029 before using this screen."}
        </p>
      </div>
    );
  }
}

export default function GrowthAgentBlogPage() {
  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-2">
          <FilePenLine className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Blog draft queue</h1>
          <p className="text-sm text-muted-foreground">
            Convert verified research packets into quality-gated, persona-authored
            CMS drafts. Every result remains unpublished until admin review.
          </p>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="glass-card rounded-xl border p-5 text-sm text-muted-foreground">
            Loading blog-ready research…
          </div>
        }
      >
        <BlogDraftContent />
      </Suspense>
    </div>
  );
}
