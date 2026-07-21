"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  AgentJobRecord,
  AgentSettingRow,
  GrowthAgentSettings,
  JsonValue,
  SourceAdapterRecord,
} from "@/lib/growth-agents/types";

const BOOLEAN_SETTINGS = [
  ["emergency_stop", "Emergency stop", "Stops new Calendar research, Blog Agent work, and affiliate monetization. Disable Chip learning and manual tools separately."],
  ["global_pause", "Global pause", "Pauses the same guarded research, blogging, and affiliate operations."],
  ["safe_mode", "Safe mode", "Keeps affiliate monetization gated; generated content remains review-controlled regardless."],
  ["research_agent_enabled", "Research Agent", "Enables evidence-backed research calls."],
  ["blogging_agent_enabled", "Blogging Agent", "Enables persona-based draft generation."],
  ["chip_learning_enabled", "Chip learning", "Enables privacy-minimized preference summaries."],
  ["affiliate_links_enabled", "Affiliate links", "Enables centralized outbound-link resolution."],
] as const;

const RETENTION_SETTINGS = [
  ["retention_raw_product_payloads_days", "Raw product payloads"],
  ["retention_chip_interaction_events_days", "Chip events"],
  ["retention_anonymous_session_profiles_days", "Anonymous profiles"],
  ["retention_chat_transcripts_days", "Full chat transcripts"],
  ["retention_agent_jobs_days", "Agent jobs"],
  ["retention_affiliate_click_events_days", "Affiliate clicks"],
  ["retention_audit_events_days", "Audit events"],
] as const;

function valueMap(rows: AgentSettingRow[]): Record<string, JsonValue> {
  return Object.fromEntries(rows.map((row) => [row.key, row.value_json]));
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClass(status: string): string {
  if (status === "succeeded" || status === "valid") return "text-emerald-500";
  if (status === "failed" || status === "invalid" || status === "error") {
    return "text-destructive";
  }
  if (status === "running") return "text-primary";
  return "text-muted-foreground";
}

interface Props {
  initialSettings: AgentSettingRow[];
  initialEffectiveSettings: GrowthAgentSettings;
  initialSources: SourceAdapterRecord[];
  initialJobs: AgentJobRecord[];
}

export function GrowthAgentControlCenter({
  initialSettings,
  initialEffectiveSettings,
  initialSources,
  initialJobs,
}: Props) {
  const [settings, setSettings] = useState(() => valueMap(initialSettings));
  const [effective, setEffective] = useState(initialEffectiveSettings);
  const [sources, setSources] = useState(initialSources);
  const [jobs, setJobs] = useState(initialJobs);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopped = effective.emergencyStop || effective.globalPause;
  const enabledCount = useMemo(
    () =>
      [
        effective.researchAgentEnabled,
        effective.bloggingAgentEnabled,
        effective.chipLearningEnabled,
        effective.affiliateLinksEnabled,
      ].filter(Boolean).length,
    [effective]
  );

  async function saveSettings() {
    setBusy("settings");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/growth-agents/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [...BOOLEAN_SETTINGS, ...RETENTION_SETTINGS].map(([key]) => ({
            key,
            value: settings[key],
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save settings.");
      setSettings(valueMap(data.settings));
      setEffective(data.effective);
      setMessage("Growth-agent settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save settings.");
    } finally {
      setBusy(null);
    }
  }

  async function updateSource(
    source: SourceAdapterRecord,
    update: { enabled?: boolean; publicDisplayAllowed?: boolean }
  ) {
    setBusy(`source:${source.source_key}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/growth-agents/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey: source.source_key, ...update }),
      });
      const data = await response.json();
      if (!response.ok) {
        const refresh = await fetch("/api/admin/growth-agents/sources", {
          cache: "no-store",
        });
        if (refresh.ok) {
          const refreshed = await refresh.json();
          setSources(refreshed.sources);
        }
        throw new Error(data.error ?? "Could not update source.");
      }
      setSources((current) =>
        current.map((item) =>
          item.source_key === data.source.source_key ? data.source : item
        )
      );
      setMessage(
        update.enabled === true && source.mode === "api"
          ? `${source.display_name} credentials validated and source enabled.`
          : `${source.display_name} updated.`
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update source.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshJobs() {
    setBusy("jobs");
    setError(null);
    try {
      const response = await fetch("/api/admin/growth-agents/jobs?limit=20");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not refresh jobs.");
      setJobs(data.jobs);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not refresh jobs.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div
        className={`rounded-xl border p-4 ${
          stopped
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-emerald-500/30 bg-emerald-500/10"
        }`}
      >
        <div className="flex items-center gap-2">
          {stopped ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          )}
          <p className="text-sm font-medium text-foreground">
            {stopped ? "Guarded research, blogging, and affiliate execution is stopped" : `${enabledCount} of 4 capabilities enabled`}
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Safe mode is {effective.safeMode ? "on" : "off"}. New installations
          keep every capability off until explicitly enabled.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-primary/10 p-3 text-xs text-primary">
          {message}
        </p>
      )}

      <section className="glass-card space-y-4 rounded-xl border p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Capability controls</h2>
          <p className="text-xs text-muted-foreground">
            Flags are checked again inside every privileged server operation.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {BOOLEAN_SETTINGS.map(([key, label, description]) => (
            <label
              key={key}
              className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3"
            >
              <span>
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
              <Switch
                checked={settings[key] === true}
                onCheckedChange={(checked) =>
                  setSettings((current) => ({ ...current, [key]: checked }))
                }
              />
            </label>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RETENTION_SETTINGS.map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs">{label} (days)</Label>
              <Input
                type="number"
                min={1}
                max={3650}
                value={typeof settings[key] === "number" ? settings[key] : 1}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    [key]: Number(event.target.value),
                  }))
                }
              />
            </div>
          ))}
        </div>
        <Button className="gap-2" disabled={busy === "settings"} onClick={saveSettings}>
          {busy === "settings" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save controls
        </Button>
      </section>

      <section className="glass-card space-y-3 rounded-xl border p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Approved sources</h2>
          <p className="text-xs text-muted-foreground">
            Turning on an API source performs a server-side credential check first. Secrets are never returned to the browser.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {sources.map((source) => (
            <div key={source.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{source.display_name}</p>
                  <p className={`text-xs ${statusClass(source.credential_status)}`}>
                    {source.mode} · {source.credential_status.replaceAll("_", " ")}
                  </p>
                </div>
                {busy === `source:${source.source_key}` ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    checked={source.enabled}
                    onCheckedChange={(checked) =>
                      updateSource(source, { enabled: checked })
                    }
                  />
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Last success: {formatDate(source.last_success_at)}
              </p>
              <label className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                Allow public outbound links
                <Switch
                  checked={source.public_display_allowed}
                  disabled={busy === `source:${source.source_key}`}
                  onCheckedChange={(checked) =>
                    updateSource(source, { publicDisplayAllowed: checked })
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card space-y-3 rounded-xl border p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Recent durable jobs</h2>
            <p className="text-xs text-muted-foreground">Payloads and errors are server-scrubbed.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={refreshJobs}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy === "jobs" ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {jobs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No jobs have run yet.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {jobs.slice(0, 12).map((job) => (
              <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span className="font-medium text-foreground">{job.job_type}</span>
                <span className={statusClass(job.status)}>{job.status}</span>
                <span className="text-muted-foreground">{formatDate(job.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
