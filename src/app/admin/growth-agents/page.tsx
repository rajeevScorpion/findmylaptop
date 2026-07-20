import { Suspense } from "react";
import { Bot } from "lucide-react";
import { requireAdmin } from "@/lib/admin/authorization";
import { GrowthAgentControlCenter } from "@/components/admin/growth-agents/GrowthAgentControlCenter";
import { listAgentJobs } from "@/lib/growth-agents/jobs";
import {
  listAgentSettingRows,
  listSourceAdapters,
  resolveAgentSettings,
} from "@/lib/growth-agents/settings";

async function ControlCenterContent() {
  await requireAdmin();
  try {
    const [settingRows, sources, jobs] = await Promise.all([
      listAgentSettingRows(),
      listSourceAdapters(),
      listAgentJobs({ limit: 20 }),
    ]);
    return (
      <GrowthAgentControlCenter
        initialSettings={settingRows}
        initialEffectiveSettings={resolveAgentSettings(settingRows)}
        initialSources={sources}
        initialJobs={jobs}
      />
    );
  } catch (error) {
    return (
      <div className="glass-card rounded-xl border border-amber-500/30 p-5 space-y-2">
        <p className="text-sm font-medium text-foreground">
          Growth-agent controls are not available yet
        </p>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "Apply migration 024 before using this screen."}
        </p>
      </div>
    );
  }
}

export default function GrowthAgentsPage() {
  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-2">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Growth Agents
          </h1>
          <p className="text-sm text-muted-foreground">
            Fail-closed controls for research, editorial drafts, Chip learning,
            and affiliate resolution.
          </p>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="glass-card rounded-xl border p-5 text-sm text-muted-foreground">
            Loading growth-agent controls…
          </div>
        }
      >
        <ControlCenterContent />
      </Suspense>
    </div>
  );
}
