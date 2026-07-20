import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, UserRoundPen } from "lucide-react";
import { getPersonaAdminEmail } from "@/lib/personas/admin-auth";
import { listPersonasWithUsage } from "@/lib/personas/service";
import { AdminGuideLink } from "@/components/admin/guide/AdminGuideLink";

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Never";
}

export default async function AdminPersonasPage() {
  if (!(await getPersonaAdminEmail())) redirect("/admin/login");
  const personas = await listPersonasWithUsage({ includeSoftDeleted: true });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Blog author personas</h1>
          <p className="text-sm text-muted-foreground">
            Manage public attribution, writing behavior, selection tags, and
            safety permissions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminGuideLink section="author-personas" />
          <Link
            href="/admin/personas/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            New persona
          </Link>
        </div>
      </div>

      <div className="glass-card divide-y divide-border/40 overflow-hidden rounded-xl border">
        {personas.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No personas yet. Apply migration 027, then create one.
          </div>
        ) : (
          personas.map(({ persona, usage }) => (
            <Link
              key={persona.id}
              href={`/admin/personas/${persona.id}`}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <UserRoundPen className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {persona.displayName}
                  </p>
                  {persona.isDefaultFallback && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                      fallback
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {persona.publicRole} · {persona.authorType.replace("_", " ")} ·
                  v{persona.version}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {usage.publishedCount} published · {usage.draftCount} drafts ·
                  last used {formatDate(usage.lastUsedAt)}
                </p>
                {persona.expertiseTags.length > 0 && (
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {persona.expertiseTags.slice(0, 4).join(" · ")}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                {persona.status.replace("_", " ")}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
