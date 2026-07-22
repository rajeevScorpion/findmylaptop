"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Play, RefreshCw, Save, ShieldCheck } from "lucide-react";
import type { DomainId } from "@/lib/domains";
import type {
  CatalogAudit,
  ProductCurationProposal,
  ProductCurationRulebook,
  ProductCurationSchedule,
} from "@/lib/product-curation/types";

interface Dashboard {
  rulebooks: ProductCurationRulebook[];
  schedule: ProductCurationSchedule;
  proposals: ProductCurationProposal[];
}

const DOMAIN_LABELS: Record<DomainId, string> = {
  design: "Design",
  technology: "Technology",
  management: "Management",
};

function asTime(value: string) { return value.slice(0, 5); }

async function api(body?: unknown) {
  const response = await fetch("/api/admin/growth-agents/curation", body === undefined ? { cache: "no-store" } : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Product curation request failed.");
  return payload;
}

export function ProductCurationManager({ initialDashboard }: { initialDashboard: Dashboard }) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [domain, setDomain] = useState<DomainId>("design");
  const [ruleDraft, setRuleDraft] = useState(() => initialDashboard.rulebooks.find((r) => r.domain === "design")!);
  const [scheduleDraft, setScheduleDraft] = useState(initialDashboard.schedule);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<CatalogAudit | null>(null);

  useEffect(() => {
    const next = dashboard.rulebooks.find((item) => item.domain === domain);
    if (next) setRuleDraft(next);
  }, [domain, dashboard.rulebooks]);

  const reload = async () => {
    const next = await api() as Dashboard;
    setDashboard(next);
    setScheduleDraft(next.schedule);
  };

  const act = async (key: string, work: () => Promise<void>, success: string) => {
    setBusy(key); setError(null); setMessage(null);
    try { await work(); await reload(); setMessage(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(null); }
  };

  const saveRulebook = () => act("rule-save", async () => {
    await api({ action: "save_rulebook", value: {
      domain,
      criteriaText: ruleDraft.criteria_text,
      enabled: ruleDraft.enabled,
      maxDomainRecommendations: Number(ruleDraft.max_domain_recommendations),
      maxCourseRecommendations: Number(ruleDraft.max_course_recommendations),
      rejectedCooldownDays: Number(ruleDraft.rejected_cooldown_days),
    } });
  }, "Rulebook saved. If its criteria changed, compile it again before discovery.");

  const compileRulebook = () => act("rule-compile", async () => {
    await api({ action: "save_rulebook", value: {
      domain,
      criteriaText: ruleDraft.criteria_text,
      enabled: ruleDraft.enabled,
      maxDomainRecommendations: Number(ruleDraft.max_domain_recommendations),
      maxCourseRecommendations: Number(ruleDraft.max_course_recommendations),
      rejectedCooldownDays: Number(ruleDraft.rejected_cooldown_days),
    } });
    await api({ action: "compile_rulebook", domain });
  }, "Rulebook compiled, validated and enabled.");

  const saveSchedule = () => act("schedule", async () => {
    await api({ action: "save_schedule", value: {
      discoveryEnabled: scheduleDraft.discovery_enabled,
      refreshEnabled: scheduleDraft.refresh_enabled,
      paused: scheduleDraft.paused,
      runTime: asTime(scheduleDraft.run_time),
      timezone: scheduleDraft.timezone,
      refreshIntervalHours: Number(scheduleDraft.refresh_interval_hours),
      maxSearchCallsPerRun: Number(scheduleDraft.max_search_calls_per_run),
      maxItemCallsPerRun: Number(scheduleDraft.max_item_calls_per_run),
      maxRequestsPerSecond: Number(scheduleDraft.max_requests_per_second),
      maxDailyRequests: Number(scheduleDraft.max_daily_requests),
      refreshBudgetPercent: Number(scheduleDraft.refresh_budget_percent),
    } });
  }, "Automation schedule saved.");

  const auditDomain = () => act("audit", async () => {
    const result = await api({ action: "audit_domain", domain });
    setAudit(result.audit);
  }, "Catalog audit completed. Any mapping changes are waiting for approval below.");

  const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";
  const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-5">
      {(message || error) && (
        <div aria-live="polite" className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"}`}>
          {error ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          {error ?? message}
        </div>
      )}

      <section className="glass-card space-y-4 rounded-xl border p-4 sm:p-5">
        <div>
          <h2 className="font-semibold">Automation and API budget</h2>
          <p className="text-xs text-muted-foreground">Refresh runs before discovery. Paused stops scheduled runs without losing configuration; the two Run now buttons remain available for an intentional admin test.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {([['discovery_enabled', 'Daily discovery'], ['refresh_enabled', 'Catalog refresh'], ['paused', 'Paused']] as const).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center justify-between rounded-lg border px-3 text-sm">
              {label}
              <input type="checkbox" checked={scheduleDraft[key]} onChange={(e) => setScheduleDraft({ ...scheduleDraft, [key]: e.target.checked })} className="h-5 w-5 accent-primary" />
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-medium">Daily time<input type="time" value={asTime(scheduleDraft.run_time)} onChange={(e) => setScheduleDraft({ ...scheduleDraft, run_time: `${e.target.value}:00` })} className={inputClass} /></label>
          <label className="space-y-1 text-xs font-medium">Timezone<input value={scheduleDraft.timezone} onChange={(e) => setScheduleDraft({ ...scheduleDraft, timezone: e.target.value })} className={inputClass} /></label>
          <label className="space-y-1 text-xs font-medium">Stale after hours<input type="number" min={1} max={24} value={scheduleDraft.refresh_interval_hours} onChange={(e) => setScheduleDraft({ ...scheduleDraft, refresh_interval_hours: Number(e.target.value) })} className={inputClass} /></label>
          <label className="space-y-1 text-xs font-medium">Daily API calls<input type="number" min={1} value={scheduleDraft.max_daily_requests} onChange={(e) => setScheduleDraft({ ...scheduleDraft, max_daily_requests: Number(e.target.value) })} className={inputClass} /></label>
          <label className="space-y-1 text-xs font-medium">Search calls/run<input type="number" min={1} max={50} value={scheduleDraft.max_search_calls_per_run} onChange={(e) => setScheduleDraft({ ...scheduleDraft, max_search_calls_per_run: Number(e.target.value) })} className={inputClass} /></label>
          <label className="space-y-1 text-xs font-medium">Item calls/run<input type="number" min={1} max={200} value={scheduleDraft.max_item_calls_per_run} onChange={(e) => setScheduleDraft({ ...scheduleDraft, max_item_calls_per_run: Number(e.target.value) })} className={inputClass} /></label>
          <label className="space-y-1 text-xs font-medium">Requests/second<input type="number" min={0.05} max={10} step={0.05} value={scheduleDraft.max_requests_per_second} onChange={(e) => setScheduleDraft({ ...scheduleDraft, max_requests_per_second: Number(e.target.value) })} className={inputClass} /></label>
          <label className="space-y-1 text-xs font-medium">Refresh budget %<input type="number" min={50} max={100} value={scheduleDraft.refresh_budget_percent} onChange={(e) => setScheduleDraft({ ...scheduleDraft, refresh_budget_percent: Number(e.target.value) })} className={inputClass} /></label>
        </div>
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          This Vercel project is on Hobby: the production poll runs once daily around 03:00 IST and may be delayed within the hour. Exact arbitrary times and rolling 22-hour execution require Pro or an external hourly scheduler. Amazon price and availability stop displaying after their freshness window.
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} disabled={busy !== null} onClick={saveSchedule}>{busy === "schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save schedule</button>
          <button className={buttonClass} disabled={busy !== null} onClick={() => act("refresh", async () => { await api({ action: "run_refresh" }); }, "Refresh run completed or queued safely.")}>{busy === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh now</button>
          <button className={buttonClass} disabled={busy !== null} onClick={() => act("discover", async () => { await api({ action: "run_discovery" }); }, "Discovery run completed. Review its candidates and mapping proposals.")}>{busy === "discover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Discover now</button>
        </div>
      </section>

      <section className="glass-card space-y-4 rounded-xl border p-4 sm:p-5">
        <div>
          <h2 className="font-semibold">Domain rulebooks</h2>
          <p className="text-xs text-muted-foreground">Write expectations in plain English. Saving changed prose disables the old compilation; Compile validates and enables the new version.</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/40 p-1">
          {(Object.keys(DOMAIN_LABELS) as DomainId[]).map((item) => <button key={item} onClick={() => setDomain(item)} className={`min-h-11 rounded-md px-2 text-xs font-medium sm:text-sm ${domain === item ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{DOMAIN_LABELS[item]}</button>)}
        </div>
        <textarea rows={12} value={ruleDraft.criteria_text} onChange={(e) => setRuleDraft({ ...ruleDraft, criteria_text: e.target.value })} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/40" />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs font-medium">Domain recommendation cap<input type="number" min={1} max={30} value={ruleDraft.max_domain_recommendations} onChange={(e) => setRuleDraft({ ...ruleDraft, max_domain_recommendations: Number(e.target.value) })} className={inputClass} /></label>
          <label className="space-y-1 text-xs font-medium">Course recommendation cap<input type="number" min={1} max={10} value={ruleDraft.max_course_recommendations} onChange={(e) => setRuleDraft({ ...ruleDraft, max_course_recommendations: Number(e.target.value) })} className={inputClass} /></label>
          <label className="space-y-1 text-xs font-medium">Rejected cooldown days<input type="number" min={1} max={365} value={ruleDraft.rejected_cooldown_days} onChange={(e) => setRuleDraft({ ...ruleDraft, rejected_cooldown_days: Number(e.target.value) })} className={inputClass} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className={`rounded-full px-2 py-1 ${ruleDraft.enabled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted"}`}>{ruleDraft.enabled ? "Enabled" : "Not enabled"}</span>
          <span>Version {ruleDraft.version}</span><span>Compiled {ruleDraft.compiled_at ? new Date(ruleDraft.compiled_at).toLocaleString() : "never"}</span>
        </div>
        {"summary" in ruleDraft.compiled_json && <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed"><strong>Compiled interpretation:</strong> {String(ruleDraft.compiled_json.summary)}</div>}
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} disabled={busy !== null} onClick={saveRulebook}>{busy === "rule-save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save prose and limits</button>
          <button className={`${buttonClass} border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90`} disabled={busy !== null} onClick={compileRulebook}>{busy === "rule-compile" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Compile and enable</button>
          <button className={buttonClass} disabled={busy !== null || !ruleDraft.enabled} onClick={auditDomain}>{busy === "audit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Audit existing catalog</button>
        </div>
        {audit?.domain === domain && <div className="grid gap-2 rounded-lg border p-3 text-xs sm:grid-cols-3"><span>Published: {audit.publishedCount}</span><span>Pending candidates: {audit.pendingCandidateCount}</span><span>Course gaps: {audit.gaps.filter((gap) => gap.missingCount > 0).length}</span><p className="sm:col-span-3 text-muted-foreground">{audit.searchReason}</p></div>}
      </section>

      <section className="glass-card space-y-3 rounded-xl border p-4 sm:p-5">
        <div><h2 className="font-semibold">Catalog decisions</h2><p className="text-xs text-muted-foreground">Agents only prepare these changes. Course tags require approval here; publication review is completed separately on the laptop.</p></div>
        {dashboard.proposals.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No course-mapping decisions are waiting.</p> : dashboard.proposals.map((proposal) => (
          <article key={proposal.id} className="space-y-3 rounded-xl border p-3 sm:p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold">{proposal.laptop?.name ?? "Catalog laptop"}</p><p className="text-xs text-muted-foreground">{proposal.proposal_type === "add_course" ? "Add" : proposal.proposal_type === "remove_course" ? "Remove" : "Review publication"} {proposal.course?.name ? `“${proposal.course.name}”` : ""}</p></div><span className="text-xs font-medium">Confidence {Math.round(proposal.confidence_score)}/100</span></div>
            <p className="text-xs leading-relaxed text-muted-foreground">{proposal.rationale}</p>
            <div className="flex flex-wrap gap-2"><button className={`${buttonClass} border-emerald-500/30 text-emerald-700 dark:text-emerald-300`} disabled={busy !== null} onClick={() => act(`proposal-${proposal.id}`, async () => { await api({ action: "review_proposal", id: proposal.id, decision: "approve", adminNotes: null }); }, proposal.proposal_type === "publication_review" ? "Publication review accepted. Inspect the laptop and publish separately if it is complete." : "Proposal approved and applied.")}>{proposal.proposal_type === "publication_review" ? "Accept for final review" : "Approve and apply"}</button><button className={`${buttonClass} border-red-500/30 text-red-700 dark:text-red-300`} disabled={busy !== null} onClick={() => act(`proposal-${proposal.id}`, async () => { await api({ action: "review_proposal", id: proposal.id, decision: "reject", adminNotes: null }); }, "Proposal rejected.")}>Reject</button><a href={`/admin/laptops/${proposal.laptop_id}`} className={buttonClass}>Inspect laptop</a></div>
          </article>
        ))}
      </section>
    </div>
  );
}
