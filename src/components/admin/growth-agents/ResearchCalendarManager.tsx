"use client";

import { useMemo, useState } from "react";
import { Loader2, Pause, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  researchPacketAuditPresentation,
  researchRunPresentation,
} from "@/lib/research-calendar/presentation";
import type {
  ResearchCalendarDashboard,
  ResearchCalendarDay,
} from "@/lib/research-calendar/types";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DAY_LIST_FIELDS = [
  "keywords",
  "target_audience",
  "preferred_persona_slugs",
  "source_priority",
] as const;
type DayListField = (typeof DAY_LIST_FIELDS)[number];
type DayListDrafts = Record<string, Record<DayListField, string>>;

function csv(value: string[]): string {
  return value.join(", ");
}

function fromCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listDraftsForDays(days: ResearchCalendarDay[]): DayListDrafts {
  return Object.fromEntries(
    days.map((day) => [
      day.id,
      Object.fromEntries(
        DAY_LIST_FIELDS.map((field) => [field, csv(day[field])])
      ),
    ])
  ) as DayListDrafts;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface Props {
  initialDashboard: ResearchCalendarDashboard;
}

interface ResearchRunApiResponse {
  error?: unknown;
  result?: {
    status?: string;
    message?: unknown;
    packetsProduced?: number;
    reasonCode?: unknown;
    selectionSummary?: unknown;
  };
  dashboard?: ResearchCalendarDashboard;
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function runErrorMessage(
  response: Response,
  payload: ResearchRunApiResponse | null
): string {
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  if (typeof payload?.result?.message === "string" && payload.result.message.trim()) {
    return payload.result.message;
  }
  return `Research run failed (HTTP ${response.status}).`;
}

export function ResearchCalendarManager({ initialDashboard }: Props) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [calendarDraft, setCalendarDraft] = useState(initialDashboard.calendar!);
  const [dayDrafts, setDayDrafts] = useState<Record<string, ResearchCalendarDay>>(
    Object.fromEntries(initialDashboard.days.map((day) => [day.id, day]))
  );
  // Keep the user's exact comma-separated text while typing. The parsed arrays
  // still update immediately, but a trailing comma is no longer erased before
  // the next value can be entered.
  const [dayListDrafts, setDayListDrafts] = useState<DayListDrafts>(() =>
    listDraftsForDays(initialDashboard.days)
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderedDays = useMemo(
    () =>
      Object.values(dayDrafts).sort(
        (a, b) => a.weekday - b.weekday || a.sort_order - b.sort_order
      ),
    [dayDrafts]
  );

  function applyDashboard(next: ResearchCalendarDashboard) {
    setDashboard(next);
    if (next.calendar) setCalendarDraft(next.calendar);
    setDayDrafts(Object.fromEntries(next.days.map((day) => [day.id, day])));
    setDayListDrafts(listDraftsForDays(next.days));
  }

  async function save(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    setMessage(null);
    setWarning(null);
    try {
      const response = await fetch("/api/admin/growth-agents/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Save failed.");
      applyDashboard(json.dashboard);
      setMessage("Saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runNow(dayId: string) {
    setBusy(`run:${dayId}`);
    setError(null);
    setMessage(null);
    setWarning(null);
    try {
      const response = await fetch("/api/admin/growth-agents/calendar/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarDayId: dayId, createBlogDrafts: true }),
      });
      const json = await readJsonResponse<ResearchRunApiResponse>(response);
      if (json?.dashboard) applyDashboard(json.dashboard);
      if (!response.ok) throw new Error(runErrorMessage(response, json));
      if (!json) throw new Error("The research run returned an invalid response.");

      const resultMessage =
        typeof json.result?.message === "string" ? json.result.message : null;
      if (json.result?.status === "disabled") {
        setError(
          resultMessage ?? "The research calendar or selected day is disabled."
        );
        return;
      }
      const fallbackMessage =
        json.result?.status === "duplicate"
          ? "That scheduled run was already processed."
          : resultMessage ??
            `Run completed with ${json.result?.packetsProduced ?? 0} research packet(s).`;
      const presentation = researchRunPresentation({
        status: json.result?.status ?? "succeeded",
        resultJson: {
          selectionSummary: json.result?.selectionSummary,
          outcomeReasonCode: json.result?.reasonCode,
        },
        fallbackMessage,
      });
      if (presentation.tone === "warning") {
        setWarning(presentation.detail ?? fallbackMessage);
      } else {
        setMessage(presentation.detail ?? fallbackMessage);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Research run failed.");
    } finally {
      setBusy(null);
    }
  }

  function patchDay(id: string, patch: Partial<ResearchCalendarDay>) {
    setDayDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  function patchDayList(id: string, field: DayListField, value: string) {
    setDayListDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value,
      },
    }));
    setDayDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: fromCsv(value),
      },
    }));
  }

  function dayListValue(day: ResearchCalendarDay, field: DayListField): string {
    return dayListDrafts[day.id]?.[field] ?? csv(day[field]);
  }

  const inputClass = "bg-background/50";

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-xl border p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Schedule control</p>
            <p className="text-xs text-muted-foreground">
              New installations stay disabled and paused until an admin explicitly enables them.
              The included Vercel schedule polls daily around 09:00 Asia/Kolkata;
              more precise custom times require a more frequent approved scheduler.
            </p>
          </div>
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Enabled
              <Switch
                checked={calendarDraft.enabled}
                onCheckedChange={(enabled) =>
                  setCalendarDraft((current) => ({ ...current, enabled }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Paused
              <Switch
                checked={calendarDraft.paused}
                onCheckedChange={(paused) =>
                  setCalendarDraft((current) => ({ ...current, paused }))
                }
              />
            </label>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Calendar name</Label>
            <Input
              className={inputClass}
              value={calendarDraft.name}
              onChange={(event) =>
                setCalendarDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Timezone</Label>
            <Input
              className={inputClass}
              value={calendarDraft.timezone}
              onChange={(event) =>
                setCalendarDraft((current) => ({ ...current, timezone: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Topic history window (days)</Label>
            <Input
              className={inputClass}
              type="number"
              min={90}
              max={365}
              value={calendarDraft.novelty_window_days}
              onChange={(event) =>
                setCalendarDraft((current) => ({
                  ...current,
                  novelty_window_days: Number(event.target.value),
                }))
              }
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Topics are compared with recent research packets and CMS posts in this period.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Topic similarity cutoff (%)</Label>
            <Input
              className={inputClass}
              type="number"
              min={20}
              max={95}
              step={1}
              value={calendarDraft.novelty_similarity_threshold}
              onChange={(event) =>
                setCalendarDraft((current) => ({
                  ...current,
                  novelty_similarity_threshold: Number(event.target.value),
                }))
              }
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Lower values block more similar topics; 62% is recommended. Exact
              titles and matching source + subject + intent anchors are treated as
              duplicates regardless of this cutoff.
            </p>
          </div>
          <label className="flex min-h-9 items-center gap-3 self-start pt-6 text-xs text-muted-foreground">
            <Switch
              checked={calendarDraft.source_rotation_enabled}
              onCheckedChange={(source_rotation_enabled) =>
                setCalendarDraft((current) => ({
                  ...current,
                  source_rotation_enabled,
                }))
              }
            />
            <span>
              Rotate recently used primary sources
              <span className="mt-0.5 block text-[11px] leading-relaxed">
                Checks the last two non-empty research runs for this day within the previous 14 days.
              </span>
            </span>
          </label>
          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm"
              value={calendarDraft.mode}
              onChange={(event) =>
                setCalendarDraft((current) => ({
                  ...current,
                  mode: event.target.value as typeof current.mode,
                }))
              }
            >
              <option value="draft_only">Draft only</option>
              <option value="approval_required">Approval required</option>
              <option value="auto_schedule">Auto-schedule (guarded)</option>
              <option value="auto_publish" disabled>Auto-publish (disabled in MVP)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max posts/day</Label>
            <Input
              className={inputClass}
              type="number"
              min={0}
              max={20}
              value={calendarDraft.max_posts_per_day}
              onChange={(event) =>
                setCalendarDraft((current) => ({
                  ...current,
                  max_posts_per_day: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max posts/week</Label>
            <Input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              value={calendarDraft.max_posts_per_week}
              onChange={(event) =>
                setCalendarDraft((current) => ({
                  ...current,
                  max_posts_per_week: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max automatic drafts/day</Label>
            <Input
              className={inputClass}
              type="number"
              min={0}
              max={20}
              value={calendarDraft.max_auto_posts_per_day}
              onChange={(event) =>
                setCalendarDraft((current) => ({
                  ...current,
                  max_auto_posts_per_day: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max automatic drafts/week</Label>
            <Input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              value={calendarDraft.max_auto_posts_per_week}
              onChange={(event) =>
                setCalendarDraft((current) => ({
                  ...current,
                  max_auto_posts_per_week: Number(event.target.value),
                }))
              }
            />
          </div>
        </div>
        <Button
          size="sm"
          className="gap-2"
          disabled={busy === "calendar"}
          onClick={() =>
            save(
              {
                calendar: {
                  name: calendarDraft.name,
                  enabled: calendarDraft.enabled,
                  paused: calendarDraft.paused,
                  timezone: calendarDraft.timezone,
                  mode: calendarDraft.mode,
                  max_posts_per_day: calendarDraft.max_posts_per_day,
                  max_posts_per_week: calendarDraft.max_posts_per_week,
                  max_auto_posts_per_day: calendarDraft.max_auto_posts_per_day,
                  max_auto_posts_per_week: calendarDraft.max_auto_posts_per_week,
                  novelty_window_days: calendarDraft.novelty_window_days,
                  novelty_similarity_threshold:
                    calendarDraft.novelty_similarity_threshold,
                  source_rotation_enabled: calendarDraft.source_rotation_enabled,
                },
              },
              "calendar"
            )
          }
        >
          {busy === "calendar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save schedule control
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          aria-atomic="true"
          className="break-words rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          aria-live="polite"
          className="break-words rounded-lg bg-primary/10 p-3 text-xs text-primary"
        >
          {message}
        </p>
      )}
      {warning && (
        <p
          role="status"
          aria-live="polite"
          className="break-words rounded-lg border border-orange-300/60 bg-orange-500/10 p-3 text-xs text-orange-700 dark:text-orange-300"
        >
          {warning}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {orderedDays.map((day) => (
          <div key={day.id} className="glass-card rounded-xl border p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{DAY_NAMES[day.weekday]}</p>
                <p className="text-[11px] text-muted-foreground">{day.theme_key}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={day.enabled} onCheckedChange={(enabled) => patchDay(day.id, { enabled })} />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={Boolean(busy)}
                  aria-label={`Run ${DAY_NAMES[day.weekday]} research now`}
                  aria-busy={busy === `run:${day.id}`}
                  onClick={() => runNow(day.id)}
                >
                  {busy === `run:${day.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Run now
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <div className="space-y-1.5">
                <Label className="text-xs">Theme</Label>
                <Input className={inputClass} value={day.theme_name} onChange={(event) => patchDay(day.id, { theme_name: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Run time</Label>
                <Input className={inputClass} type="time" value={day.run_time.slice(0, 5)} onChange={(event) => patchDay(day.id, { run_time: event.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea className={inputClass} rows={2} value={day.theme_description ?? ""} onChange={(event) => patchDay(day.id, { theme_description: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Keywords (comma separated)</Label>
              <Input className={inputClass} value={dayListValue(day, "keywords")} onChange={(event) => patchDayList(day.id, "keywords", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target audiences (comma separated)</Label>
              <Input className={inputClass} value={dayListValue(day, "target_audience")} onChange={(event) => patchDayList(day.id, "target_audience", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preferred persona slugs (comma separated)</Label>
              <Input className={inputClass} value={dayListValue(day, "preferred_persona_slugs")} onChange={(event) => patchDayList(day.id, "preferred_persona_slugs", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Source priority groups (comma separated)</Label>
              <Input className={inputClass} value={dayListValue(day, "source_priority")} onChange={(event) => patchDayList(day.id, "source_priority", event.target.value)} />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Examples: official-software, official-documentation, official-platform, or approved-web.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["min_posts", "target_posts", "max_posts"] as const).map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs">{field.replace("_", " ")}</Label>
                  <Input className={inputClass} type="number" min={0} max={20} value={day[field]} onChange={(event) => patchDay(day.id, { [field]: Number(event.target.value) })} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Research confidence</Label>
                <Input className={inputClass} type="number" min={0} max={100} value={day.min_research_confidence} onChange={(event) => patchDay(day.id, { min_research_confidence: Number(event.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Blog quality</Label>
                <Input className={inputClass} type="number" min={0} max={100} value={day.min_blog_quality} onChange={(event) => patchDay(day.id, { min_blog_quality: Number(event.target.value) })} />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={busy === `save:${day.id}`}
              onClick={() =>
                save(
                  {
                    days: [
                      {
                        id: day.id,
                        enabled: day.enabled,
                        run_time: day.run_time.slice(0, 5),
                        theme_name: day.theme_name,
                        theme_description: day.theme_description,
                        keywords: day.keywords,
                        target_audience: day.target_audience,
                        preferred_persona_slugs: day.preferred_persona_slugs,
                        source_priority: day.source_priority,
                        min_posts: day.min_posts,
                        target_posts: day.target_posts,
                        max_posts: day.max_posts,
                        min_research_confidence: day.min_research_confidence,
                        min_blog_quality: day.min_blog_quality,
                      },
                    ],
                  },
                  `save:${day.id}`
                )
              }
            >
              {busy === `save:${day.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save {DAY_NAMES[day.weekday]}
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-xl border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Pause className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Recent runs</h2>
          </div>
          {dashboard.recentRuns.length === 0 ? (
            <p className="text-xs text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.recentRuns.slice(0, 8).map((run) => {
                const presentation = researchRunPresentation({
                  status: run.status,
                  resultJson: run.result_json,
                  outcomeReasonCode: run.outcome_reason_code,
                  errorMessage: run.error_message,
                });
                return (
                  <div key={run.id} className="rounded-lg border border-border/50 p-3 text-xs">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                      <span className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                        <span className="capitalize">{presentation.label}</span>
                        {presentation.reasonLabel && (
                          <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-300">
                            {presentation.reasonLabel}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground">{formatDate(run.created_at)}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{run.packets_produced} packet(s), {run.drafts_produced} draft(s)</p>
                    {presentation.detail && (
                      <p
                        className={`mt-1 break-words ${
                          presentation.tone === "error"
                            ? "text-destructive"
                            : presentation.tone === "warning"
                              ? "text-orange-700 dark:text-orange-300"
                              : "text-muted-foreground"
                        }`}
                      >
                        {presentation.detail}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="glass-card rounded-xl border p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Recent research packets</h2>
          {dashboard.recentPackets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No packets yet.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.recentPackets.slice(0, 8).map((packet) => {
                const audit = researchPacketAuditPresentation({
                  noveltyScore: packet.novelty_score,
                  nearestTopicSimilarity: packet.nearest_topic_similarity,
                  nearestTopicKind: packet.nearest_topic_kind,
                  nearestTopicTitle: packet.nearest_topic_title,
                  sourceDomains: packet.source_domains,
                  sourceRefs: packet.source_refs_json,
                });
                return (
                  <div
                    key={packet.id}
                    className="overflow-hidden rounded-lg border border-border/50 p-3 text-xs"
                  >
                  <p className="break-words font-medium text-foreground">
                    {packet.topic_title}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {packet.status.replaceAll("_", " ")} · confidence{" "}
                    {packet.confidence_score}
                  </p>
                  <p className="mt-1 line-clamp-2 break-words text-muted-foreground">
                    {packet.summary}
                  </p>
                  <details className="mt-3 rounded-md border border-border/50 bg-muted/20 px-3">
                    <summary className="cursor-pointer select-none py-2 font-medium text-foreground">
                      Novelty and source audit
                    </summary>
                    <div className="space-y-3 border-t border-border/50 py-3">
                      <dl className="grid gap-2 sm:grid-cols-2">
                        <div className="min-w-0 rounded-md bg-background/60 p-2">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Novelty score
                          </dt>
                          <dd className="mt-0.5 break-words font-medium text-foreground">
                            {audit.noveltyScoreLabel}
                          </dd>
                          <dd className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                            Higher means more different from recent topics.
                          </dd>
                        </div>
                        <div className="min-w-0 rounded-md bg-background/60 p-2">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Nearest topic type
                          </dt>
                          <dd className="mt-0.5 break-words font-medium text-foreground">
                            {audit.nearestTopicKindLabel}
                          </dd>
                        </div>
                        <div className="min-w-0 rounded-md bg-background/60 p-2 sm:col-span-2">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Nearest topic title
                          </dt>
                          <dd className="mt-0.5 break-words font-medium text-foreground">
                            {audit.nearestTopicTitleLabel}
                          </dd>
                        </div>
                        <div className="min-w-0 rounded-md bg-background/60 p-2 sm:col-span-2">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Similarity to nearest topic
                          </dt>
                          <dd className="mt-0.5 break-words font-medium text-foreground">
                            {audit.nearestTopicSimilarityLabel}
                          </dd>
                        </div>
                      </dl>

                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Source domains
                        </p>
                        {audit.sourceDomains.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {audit.sourceDomains.map((domain) => (
                              <span
                                key={domain}
                                className="max-w-full break-all rounded-full bg-background/70 px-2 py-1 text-[10px] text-foreground"
                              >
                                {domain}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-muted-foreground">
                            None recorded.
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Source URLs
                        </p>
                        {audit.sourceLinks.length > 0 ? (
                          <ul className="mt-1.5 space-y-1.5">
                            {audit.sourceLinks.map((source) => (
                              <li key={source.url} className="min-w-0">
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block min-w-0 rounded-md bg-background/70 p-2 text-primary hover:underline"
                                >
                                  <span className="block break-words font-medium">
                                    {source.title ?? source.domain}
                                  </span>
                                  <span className="mt-0.5 block break-all text-[10px] text-muted-foreground">
                                    {source.url}
                                  </span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-muted-foreground">
                            No safe HTTP(S) source URLs recorded.
                          </p>
                        )}
                      </div>
                    </div>
                  </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
