"use client";

import { useMemo, useState } from "react";
import { Loader2, Pause, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  ResearchCalendarDashboard,
  ResearchCalendarDay,
} from "@/lib/research-calendar/types";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function csv(value: string[]): string {
  return value.join(", ");
}

function fromCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
  }

  async function save(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    setMessage(null);
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
      setMessage(
        json.result?.status === "duplicate"
          ? "That scheduled run was already processed."
          : resultMessage ??
              `Run completed with ${json.result?.packetsProduced ?? 0} research packet(s).`
      );
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
              <Input className={inputClass} value={csv(day.keywords)} onChange={(event) => patchDay(day.id, { keywords: fromCsv(event.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target audiences</Label>
              <Input className={inputClass} value={csv(day.target_audience)} onChange={(event) => patchDay(day.id, { target_audience: fromCsv(event.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preferred persona slugs</Label>
              <Input className={inputClass} value={csv(day.preferred_persona_slugs)} onChange={(event) => patchDay(day.id, { preferred_persona_slugs: fromCsv(event.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Source priority</Label>
              <Input className={inputClass} value={csv(day.source_priority)} onChange={(event) => patchDay(day.id, { source_priority: fromCsv(event.target.value) })} />
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
              {dashboard.recentRuns.slice(0, 8).map((run) => (
                <div key={run.id} className="rounded-lg border border-border/50 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{run.status.replaceAll("_", " ")}</span>
                    <span className="text-muted-foreground">{formatDate(run.created_at)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{run.packets_produced} packet(s), {run.drafts_produced} draft(s)</p>
                  {run.error_message && <p className="mt-1 break-words text-destructive">{run.error_message}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass-card rounded-xl border p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Recent research packets</h2>
          {dashboard.recentPackets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No packets yet.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.recentPackets.slice(0, 8).map((packet) => (
                <div key={packet.id} className="rounded-lg border border-border/50 p-3 text-xs">
                  <p className="font-medium text-foreground">{packet.topic_title}</p>
                  <p className="mt-1 text-muted-foreground">{packet.status.replaceAll("_", " ")} · confidence {packet.confidence_score}</p>
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{packet.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
