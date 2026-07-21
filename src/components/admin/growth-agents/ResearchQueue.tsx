"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileJson,
  HeartPulse,
  Loader2,
  PencilLine,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import type { SourceCredentialStatus } from "@/lib/growth-agents/types";
import type {
  CandidateReviewStatus,
  ProductCandidateRow,
  SourceCapabilities,
  SourceHealthStatus,
} from "@/lib/sources/types";

export interface ResearchSourceHealth {
  sourceKey: string;
  displayName: string;
  mode: "api" | "manual" | "feed";
  enabled: boolean;
  runtimeEnabled: boolean;
  databaseEnabled: boolean;
  configured: boolean;
  status: SourceHealthStatus;
  message: string;
  checkedAt: string;
  capabilities: SourceCapabilities;
  remoteChecked: boolean;
  credentialStatus: SourceCredentialStatus;
  freshnessTtlMinutes: number | null;
  publicDisplayAllowed: boolean;
  requiresAdminApproval: boolean;
}

interface ResearchQueueProps {
  initialCandidates: ProductCandidateRow[];
  initialSources: ResearchSourceHealth[];
  initialError?: string | null;
}

type ReviewAction = "approve" | "reject" | "needs_edit" | "stale";

const MANUAL_EXAMPLE = JSON.stringify(
  {
    source: "manual",
    title: "Example laptop - replace every known value",
    url: "https://retailer.example/product/laptop",
    brand: "Example brand",
    model: "Example model",
    cpu: "Exact processor from the source",
    gpu: "Exact graphics from the source",
    ramGb: 16,
    ramType: "DDR5",
    storageGb: 512,
    storageType: "SSD",
    display: "15.6 inch Full HD IPS",
    features: ["Only include facts visible in the approved source"],
  },
  null,
  2
);

const STATUS_TONE: Record<CandidateReviewStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-300",
  needs_edit: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  stale: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
};

const HEALTH_TONE: Record<SourceHealthStatus, string> = {
  ready: "text-emerald-600 dark:text-emerald-400",
  disabled: "text-muted-foreground",
  unconfigured: "text-amber-600 dark:text-amber-400",
  degraded: "text-amber-600 dark:text-amber-400",
  unavailable: "text-red-600 dark:text-red-400",
};

function label(value: string): string {
  return value.replace(/_/g, " ");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null || !currency) return "No price supplied";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return { error: `Request failed with HTTP ${response.status}.` };
  }
}

function SourceHealthCard({ source }: { source: ResearchSourceHealth }) {
  const validatedWhileDisabled =
    source.mode === "api" &&
    source.credentialStatus === "valid" &&
    !source.databaseEnabled;
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-3.5 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{source.displayName}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {source.mode} · {source.sourceKey}
          </p>
        </div>
        <span
          className={`text-xs font-medium capitalize ${
            validatedWhileDisabled
              ? "text-emerald-500"
              : HEALTH_TONE[source.status]
          }`}
        >
          {validatedWhileDisabled ? "Validated" : label(source.status)}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{source.message}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>Queue: {source.databaseEnabled ? "enabled" : "disabled"}</span>
        <span>Credentials: {label(source.credentialStatus)}</span>
        <span>
          Freshness: {source.freshnessTtlMinutes ? `${source.freshnessTtlMinutes} min` : "unknown"}
        </span>
        <span>{source.remoteChecked ? "Remote checked" : "Configuration check"}</span>
      </div>
    </div>
  );
}

function Score({ label: scoreLabel, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{scoreLabel}</span>
        <span className="font-medium text-foreground">{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  busy,
  error,
  notes,
  onNotes,
  onAction,
}: {
  candidate: ProductCandidateRow;
  busy: boolean;
  error?: string;
  notes: string;
  onNotes: (value: string) => void;
  onAction: (action: ReviewAction) => void;
}) {
  const product = candidate.normalized_json;
  const freshPrice =
    product.priceFreshness === "fresh" && candidate.compliance_status === "safe";
  const canReview = candidate.review_status !== "approved";
  const specs = [
    ["CPU", product.cpu?.label],
    ["GPU", product.gpu?.label],
    ["RAM", product.ramGb ? `${product.ramGb} GB${product.ramType ? ` ${product.ramType}` : ""}` : undefined],
    [
      "Storage",
      product.storageGb
        ? `${product.storageGb} GB${product.storageType ? ` ${product.storageType}` : ""}`
        : undefined,
    ],
    ["Display", product.display?.label],
    ["Weight", product.weightKg ? `${product.weightKg} kg` : undefined],
  ] as const;

  return (
    <article className="glass-card rounded-xl border overflow-hidden">
      <div className="p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {candidate.source_key}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[candidate.review_status]}`}>
                {label(candidate.review_status)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  candidate.compliance_status === "safe"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : candidate.compliance_status === "blocked"
                      ? "bg-red-500/10 text-red-700 dark:text-red-300"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                {label(candidate.compliance_status)}
              </span>
            </div>
            <h2 className="text-base font-semibold leading-snug text-foreground">
              {candidate.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {[candidate.brand, candidate.model, candidate.source_product_id]
                .filter(Boolean)
                .join(" · ") || "Brand, model, and source ID unknown"}
            </p>
          </div>
          <a
            href={candidate.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Verify source <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {specs.map(([name, value]) => (
            <div key={name} className="rounded-lg bg-muted/35 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{name}</p>
              <p className={`mt-0.5 text-xs ${value ? "text-foreground" : "italic text-muted-foreground"}`}>
                {value ?? "Unknown"}
              </p>
            </div>
          ))}
          <div className="rounded-lg bg-muted/35 px-3 py-2 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Price snapshot</p>
            <p className={`mt-0.5 text-xs ${freshPrice ? "text-foreground" : "text-amber-700 dark:text-amber-300"}`}>
              {candidate.price_amount === null
                ? "No exact price supplied — use “Check current price”."
                : freshPrice
                  ? `${formatMoney(candidate.price_amount, candidate.price_currency)} · fresh`
                  : `${formatMoney(candidate.price_amount, candidate.price_currency)} · ${label(product.priceFreshness)} snapshot; do not publish as current`}
            </p>
          </div>
        </div>

        <div className="grid gap-4 border-y border-border/30 py-3 sm:grid-cols-[160px_160px_1fr]">
          <Score label="Confidence" value={candidate.confidence_score} />
          <Score label="Fit" value={candidate.fit_score} />
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            <p>Source fetched: {formatDate(candidate.source_fetched_at)}</p>
            <p>Price fetched: {formatDate(candidate.price_fetched_at)}</p>
            <p>Fresh until: {formatDate(candidate.fresh_until)}</p>
          </div>
        </div>

        {(candidate.fit_tags.length > 0 || candidate.risk_tags.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Fit evidence</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {candidate.fit_tags.length > 0 ? candidate.fit_tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                    {label(tag)}
                  </span>
                )) : <span className="text-xs italic text-muted-foreground">No fit tags</span>}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Risks</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {candidate.risk_tags.length > 0 ? candidate.risk_tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                    {label(tag)}
                  </span>
                )) : <span className="text-xs text-emerald-600 dark:text-emerald-400">No detected risks</span>}
              </div>
            </div>
          </div>
        )}

        {(candidate.error_message || error) && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error ?? candidate.error_message}</span>
          </div>
        )}

        {candidate.admin_notes && !canReview && (
          <p className="rounded-lg bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
            Admin note: {candidate.admin_notes}
          </p>
        )}

        {canReview ? (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={(event) => onNotes(event.target.value)}
              placeholder="Optional admin note for this decision"
              rows={2}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring/40"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAction("approve")}
                disabled={busy || candidate.compliance_status === "blocked"}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Approve to unpublished laptop
              </button>
              <button
                type="button"
                onClick={() => onAction("needs_edit")}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 text-xs font-medium hover:bg-muted disabled:opacity-40"
              >
                <PencilLine className="h-3.5 w-3.5" /> Needs edit
              </button>
              <button
                type="button"
                onClick={() => onAction("stale")}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 text-xs font-medium hover:bg-muted disabled:opacity-40"
              >
                <Clock3 className="h-3.5 w-3.5" /> Mark stale
              </button>
              <button
                type="button"
                onClick={() => onAction("reject")}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 text-xs font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-40 dark:text-red-300"
              >
                <X className="h-3.5 w-3.5" /> Reject
              </button>
            </div>
            {candidate.compliance_status === "blocked" && (
              <p className="text-[11px] text-red-600 dark:text-red-400">
                Approval is blocked by compliance checks. Correct the source data and re-import it.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Approved; still unpublished
            </span>
            {candidate.promoted_laptop_id && (
              <a
                href={`/admin/laptops/${candidate.promoted_laptop_id}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Complete final laptop review <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function ResearchQueue({
  initialCandidates,
  initialSources,
  initialError = null,
}: ResearchQueueProps) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [sources, setSources] = useState(initialSources);
  const [sourceKey, setSourceKey] = useState("manual");
  const [manualJson, setManualJson] = useState(MANUAL_EXAMPLE);
  const [identifier, setIdentifier] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CandidateReviewStatus>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);
  const [candidateErrors, setCandidateErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const selectedSource = sources.find((source) => source.sourceKey === sourceKey);
  const visible = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          (statusFilter === "all" || candidate.review_status === statusFilter) &&
          (sourceFilter === "all" || candidate.source_key === sourceFilter)
      ),
    [candidates, sourceFilter, statusFilter]
  );

  function replaceCandidate(candidate: ProductCandidateRow) {
    setCandidates((current) => {
      const rest = current.filter((entry) => entry.id !== candidate.id);
      return [candidate, ...rest];
    });
  }

  async function importCandidate() {
    setImporting(true);
    setPageError(null);
    setSuccess(null);
    try {
      let body: Record<string, unknown>;
      if (sourceKey === "manual") {
        let payload: unknown;
        try {
          payload = JSON.parse(manualJson);
        } catch {
          throw new Error("Manual import must be valid JSON.");
        }
        body = { sourceKey, payload };
      } else {
        const value = identifier.trim();
        if (!value) throw new Error("Enter a product URL or direct product ID.");
        body = value.startsWith("http")
          ? { sourceKey, url: value }
          : { sourceKey, productId: value };
      }

      const response = await fetch("/api/admin/growth-agents/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await responseBody(response);
      if (!response.ok) throw new Error(String(result.error ?? "Candidate import failed."));
      const candidate = result.candidate as ProductCandidateRow;
      replaceCandidate(candidate);
      setSuccess(result.created ? "Candidate added to the review queue." : "Existing candidate refreshed.");
      if (sourceKey !== "manual") setIdentifier("");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Candidate import failed.");
    } finally {
      setImporting(false);
    }
  }

  async function runAction(candidate: ProductCandidateRow, action: ReviewAction) {
    setBusyId(candidate.id);
    setCandidateErrors((current) => ({ ...current, [candidate.id]: "" }));
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/admin/growth-agents/candidates/${candidate.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            adminNotes: notes[candidate.id]?.trim() || undefined,
          }),
        }
      );
      const result = await responseBody(response);
      if (!response.ok) throw new Error(String(result.error ?? "Review action failed."));
      replaceCandidate(result.candidate as ProductCandidateRow);
      setSuccess(
        action === "approve"
          ? "Candidate promoted to an unpublished laptop for final review."
          : `Candidate marked ${label(action)}.`
      );
    } catch (error) {
      setCandidateErrors((current) => ({
        ...current,
        [candidate.id]: error instanceof Error ? error.message : "Review action failed.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function refreshHealth() {
    setHealthBusy(true);
    setPageError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/growth-agents/sources/health", {
        method: "POST",
        cache: "no-store",
      });
      const result = await responseBody(response);
      if (!response.ok) throw new Error(String(result.error ?? "Health check failed."));
      setSources(result.sources as ResearchSourceHealth[]);
      setSuccess(
        "Source health saved. A validated source remains off until you enable it under Growth Agents."
      );
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Health check failed.");
    } finally {
      setHealthBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {(pageError || success) && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            pageError
              ? "border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-300"
              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {pageError ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{pageError ?? success}</span>
        </div>
      )}

      <section className="glass-card rounded-xl border p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Source health</h2>
            <p className="text-xs text-muted-foreground">
              Runtime configuration and fail-closed queue enablement. Tokens are never returned.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a
              href="/admin/growth-agents"
              className="inline-flex h-8 items-center rounded-lg border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              Manage sources
            </a>
            <button
              type="button"
              onClick={refreshHealth}
              disabled={healthBusy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 text-xs font-medium hover:bg-muted disabled:opacity-40"
            >
              {healthBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HeartPulse className="h-3.5 w-3.5" />}
              Probe health
            </button>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {sources.map((source) => <SourceHealthCard key={source.sourceKey} source={source} />)}
        </div>
      </section>

      <section className="glass-card rounded-xl border p-4 space-y-4">
        <div className="flex items-start gap-2">
          <FileJson className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Add a candidate</h2>
            <p className="text-xs text-muted-foreground">
              Manual JSON is always local to this admin request. API sources use official endpoints only.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <div className="space-y-1.5">
            <label htmlFor="candidate-source" className="text-xs font-medium text-foreground">Source adapter</label>
            <select
              id="candidate-source"
              value={sourceKey}
              onChange={(event) => setSourceKey(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            >
              {sources.map((source) => (
                <option key={source.sourceKey} value={source.sourceKey}>
                  {source.displayName}{source.enabled ? "" : " (disabled)"}
                </option>
              ))}
            </select>
            {selectedSource && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {selectedSource.message}
              </p>
            )}
          </div>
          {sourceKey === "manual" ? (
            <div className="space-y-1.5">
              <label htmlFor="candidate-json" className="text-xs font-medium text-foreground">Product JSON</label>
              <textarea
                id="candidate-json"
                value={manualJson}
                onChange={(event) => setManualJson(event.target.value)}
                rows={12}
                spellCheck={false}
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="candidate-identifier" className="text-xs font-medium text-foreground">
                {sourceKey === "amazon" ? "Amazon product URL or ASIN" : "Direct Flipkart product ID"}
              </label>
              <input
                id="candidate-identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder={sourceKey === "amazon" ? "https://www.amazon.in/dp/... or 10-character ASIN" : "Flipkart product ID"}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            Missing specs remain unknown. Import never publishes a laptop.
          </p>
          <button
            type="button"
            onClick={importCandidate}
            disabled={importing || !selectedSource?.enabled}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Normalize and queue
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Review queue</h2>
            <p className="text-xs text-muted-foreground">
              {visible.length} of {candidates.length} candidates shown
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | CandidateReviewStatus)}
              aria-label="Filter by review status"
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="needs_edit">Needs edit</option>
              <option value="stale">Stale</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              aria-label="Filter by source"
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
            >
              <option value="all">All sources</option>
              {[...new Set(candidates.map((candidate) => candidate.source_key))].map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
        </div>

        {visible.length > 0 ? (
          <div className="space-y-3">
            {visible.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                busy={busyId === candidate.id}
                error={candidateErrors[candidate.id]}
                notes={notes[candidate.id] ?? candidate.admin_notes ?? ""}
                onNotes={(value) => setNotes((current) => ({ ...current, [candidate.id]: value }))}
                onAction={(action) => runAction(candidate, action)}
              />
            ))}
          </div>
        ) : (
          <div className="glass-card flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
            <RefreshCw className="h-5 w-5 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium text-foreground">No candidates match these filters</p>
            <p className="mt-1 text-xs text-muted-foreground">Import a product or change the queue filters.</p>
          </div>
        )}
      </section>
    </div>
  );
}
