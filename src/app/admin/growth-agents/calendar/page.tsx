import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { requireAdmin } from "@/lib/admin/authorization";
import { getResearchCalendarDashboard } from "@/lib/research-calendar/service";
import { ResearchCalendarManager } from "@/components/admin/growth-agents/ResearchCalendarManager";
import { AdminGuideLink } from "@/components/admin/guide/AdminGuideLink";

async function CalendarContent() {
  await requireAdmin();
  try {
    const dashboard = await getResearchCalendarDashboard();
    if (!dashboard.calendar) {
      return (
        <div className="glass-card rounded-xl border p-5 text-sm text-muted-foreground">
          No research calendar exists. Apply migrations 024–026 in order.
        </div>
      );
    }
    return <ResearchCalendarManager initialDashboard={dashboard} />;
  } catch (error) {
    return (
      <div className="glass-card rounded-xl border border-amber-500/30 p-5 space-y-2">
        <p className="text-sm font-medium text-foreground">
          Research calendar is not available yet
        </p>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "Apply the autonomous-agent migrations before using this screen."}
        </p>
      </div>
    );
  }
}

export default function ResearchCalendarPage() {
  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-2">
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Research Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Configure daily research themes and draft targets. Publishing and
              affiliate insertion remain review-controlled.
            </p>
          </div>
        </div>
        <AdminGuideLink section="research-calendar" />
      </div>
      <Suspense
        fallback={
          <div className="glass-card rounded-xl border p-5 text-sm text-muted-foreground">
            Loading research calendar…
          </div>
        }
      >
        <CalendarContent />
      </Suspense>
    </div>
  );
}
