import { Suspense } from "react";
import { BookMarked } from "lucide-react";
import { requireAdmin } from "@/lib/admin/authorization";
import {
  getProductCurationSchedule,
  listCurationProposals,
  listProductRulebooks,
} from "@/lib/product-curation/service";
import { ProductCurationManager } from "@/components/admin/growth-agents/ProductCurationManager";
import { AdminGuideLink } from "@/components/admin/guide/AdminGuideLink";

async function CurationContent() {
  await requireAdmin();
  try {
    const [rulebooks, schedule, proposals] = await Promise.all([
      listProductRulebooks(),
      getProductCurationSchedule(),
      listCurationProposals(),
    ]);
    return <ProductCurationManager initialDashboard={{ rulebooks, schedule, proposals }} />;
  } catch (error) {
    return (
      <div className="glass-card rounded-xl border border-amber-500/30 p-5 space-y-2">
        <p className="text-sm font-medium">Product curation is not available yet</p>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : "Apply migration 034 after migrations 024–033."}
        </p>
      </div>
    );
  }
}

export default function ProductCurationPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-2">
          <BookMarked className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Product curation</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Define domain rulebooks, audit the existing catalog, and let agents prepare a deliberately small set of product and course-mapping decisions. Publication remains a separate admin action.
          </p>
        </div>
        </div>
        <AdminGuideLink section="product-curation" />
      </div>
      <Suspense fallback={<div className="glass-card rounded-xl border p-5 text-sm text-muted-foreground">Loading product curation…</div>}>
        <CurationContent />
      </Suspense>
    </div>
  );
}
