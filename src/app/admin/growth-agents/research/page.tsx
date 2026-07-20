import { requireAdmin } from "@/lib/admin/authorization";
import { isAgentError } from "@/lib/growth-agents/errors";
import { listCandidates } from "@/lib/products/candidates";
import { getEffectiveSourceHealth } from "@/lib/sources/health";
import {
  ResearchQueue,
  type ResearchSourceHealth,
} from "@/components/admin/growth-agents/ResearchQueue";
import { AdminGuideLink } from "@/components/admin/guide/AdminGuideLink";

export default async function GrowthAgentResearchPage() {
  await requireAdmin();

  const [candidateResult, sourceResult] = await Promise.allSettled([
    listCandidates({ limit: 150 }),
    getEffectiveSourceHealth(),
  ]);
  const candidates =
    candidateResult.status === "fulfilled" ? candidateResult.value : [];
  const sources =
    sourceResult.status === "fulfilled"
      ? (sourceResult.value as ResearchSourceHealth[])
      : [];
  const errors = [
    candidateResult.status === "rejected"
      ? isAgentError(candidateResult.reason)
        ? candidateResult.reason.message
        : "Could not load the candidate queue. Confirm migration 025 has been applied."
      : null,
    sourceResult.status === "rejected"
      ? isAgentError(sourceResult.reason)
        ? sourceResult.reason.message
        : "Could not load source health. Confirm migration 024 has been applied."
      : null,
  ].filter((message): message is string => Boolean(message));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Product research queue</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Import from approved sources, inspect normalized evidence and freshness,
            then promote complete candidates to unpublished laptops for final admin review.
          </p>
        </div>
        <AdminGuideLink section="research-queue" />
      </div>

      <ResearchQueue
        initialCandidates={candidates}
        initialSources={sources}
        initialError={errors.length > 0 ? errors.join(" ") : null}
      />
    </div>
  );
}
