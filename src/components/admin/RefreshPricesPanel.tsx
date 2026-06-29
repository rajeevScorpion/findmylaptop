"use client";

import { useMemo, useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Circle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Laptop = {
  id: string;
  name: string;
  brand?: string | null;
  price_label?: string | null;
  availability?: string | null;
  last_checked?: string | null;
  amazon_affiliate_url?: string | null;
  created_at?: string | null;
  is_published?: boolean;
};

type UpdatedRow = {
  id: string;
  price_label: string | null;
  availability: string | null;
  last_checked: string;
  auto_unpublished?: boolean;
  auto_republished?: boolean;
};

type RefreshResult = {
  total: number;
  updated: number;
  failed: number;
  errors: string[];
  rows?: UpdatedRow[];
};

const PAGE_SIZE = 15;

function isUnavailable(availability: string | null | undefined): boolean {
  if (!availability) return false;
  const l = availability.toLowerCase();
  return l.includes("unavailable") || l.includes("out of stock") || l.includes("not available");
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({
  availability,
  lastChecked,
}: {
  availability?: string | null;
  lastChecked?: string | null;
}) {
  let label: string;
  let color: string;

  if (!availability) {
    label = lastChecked ? "Unknown" : "Not checked";
    color = "bg-muted text-muted-foreground";
  } else {
    const lower = availability.toLowerCase();
    const isInStock = lower.includes("in stock") || lower === "now";
    const isOutOfStock = isUnavailable(availability);
    label = availability;
    color = isInStock
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : isOutOfStock
      ? "bg-red-500/10 text-red-600 dark:text-red-400"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-1 sm:px-2 py-0.5 ${color}`}
    >
      <Circle className="w-2 h-2 fill-current shrink-0" />
      <span className="hidden sm:inline whitespace-nowrap">{label}</span>
    </span>
  );
}

function AmazonLink({ url }: { url?: string | null }) {
  if (!url) return <span className="text-muted-foreground/30">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Check on Amazon"
      className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      <ExternalLink className="w-3.5 h-3.5" />
    </a>
  );
}

export function RefreshPricesPanel({ laptops: initialLaptops }: { laptops: Laptop[] }) {
  const [laptops, setLaptops] = useState<Laptop[]>(initialLaptops);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attentionOpen, setAttentionOpen] = useState(true);
  const [republishingId, setRepublishingId] = useState<string | null>(null);

  const publishedLaptops = useMemo(
    () => laptops.filter((l) => l.is_published !== false),
    [laptops]
  );
  const attentionLaptops = useMemo(
    () => laptops.filter((l) => l.is_published === false && l.last_checked && isUnavailable(l.availability)),
    [laptops]
  );

  const totalPages = Math.max(1, Math.ceil(publishedLaptops.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pageLaptops = useMemo(
    () => publishedLaptops.slice(pageStart, pageStart + PAGE_SIZE),
    [publishedLaptops, pageStart]
  );

  function applyRows(rows: UpdatedRow[] | undefined) {
    if (!rows?.length) return;
    const byId = new Map(rows.map((r) => [r.id, r]));
    setLaptops((prev) =>
      prev.map((l) => {
        const u = byId.get(l.id);
        if (!u) return l;
        return {
          ...l,
          price_label: u.price_label,
          availability: u.availability,
          last_checked: u.last_checked,
          ...(u.auto_unpublished && { is_published: false }),
          ...(u.auto_republished && { is_published: true }),
        };
      })
    );
  }

  async function refresh(
    scope: "all" | "page" | "unpublished" | string,
    ids?: string[],
    republishIfAvailable?: boolean
  ) {
    setBusy(scope);
    setResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/refresh-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(ids ? { ids } : {}),
          ...(republishIfAvailable ? { republishIfAvailable: true } : {}),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Unknown error");
        return;
      }

      applyRows(data.rows);
      setResult(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  async function republish(laptopId: string) {
    setRepublishingId(laptopId);
    const supabase = createClient();
    const { error } = await supabase
      .from("laptops")
      .update({ is_published: true })
      .eq("id", laptopId);

    if (!error) {
      setLaptops((prev) =>
        prev.map((l) => (l.id === laptopId ? { ...l, is_published: true } : l))
      );
    }
    setRepublishingId(null);
  }

  const anyBusy = busy !== null;
  const pageIds = pageLaptops.map((l) => l.id);
  const attentionIds = attentionLaptops.map((l) => l.id);

  return (
    <div className="space-y-4">
      {/* Attention section — unpublished laptops with unavailability */}
      {attentionLaptops.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          <div className="w-full flex items-center gap-2.5 px-4 py-3">
            <button
              onClick={() => setAttentionOpen((v) => !v)}
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400 flex-1 truncate">
                {attentionLaptops.length} auto-unpublished — check if back in stock
              </span>
            </button>
            <button
              onClick={() => refresh("unpublished", attentionIds, true)}
              disabled={anyBusy}
              title="Re-check all unpublished on Amazon — auto-publishes any back in stock"
              className="inline-flex items-center gap-1.5 rounded-md h-7 px-2.5 text-xs font-medium border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy === "unpublished" ? "animate-spin" : ""}`} />
              {busy === "unpublished" ? "Checking…" : "Refresh all unpublished"}
            </button>
            <button
              onClick={() => setAttentionOpen((v) => !v)}
              className="shrink-0"
              aria-label={attentionOpen ? "Collapse" : "Expand"}
            >
              <ChevronDown
                className={`w-4 h-4 text-amber-500 transition-transform ${attentionOpen ? "" : "-rotate-90"}`}
              />
            </button>
          </div>
          {attentionOpen && (
            <>
              {/* Attention table header */}
              <div className="flex items-center gap-3 px-4 py-2 border-t border-amber-500/20 bg-amber-500/5 text-xs font-medium text-amber-700/60 dark:text-amber-400/60 uppercase tracking-wide">
                <div className="flex-1 min-w-0">Name</div>
                <div className="shrink-0 w-10 sm:w-36 text-center">Last status</div>
                <div className="shrink-0 w-20 sm:w-24 text-right">Last checked</div>
                <div className="shrink-0 w-7" />
                <div className="shrink-0 w-7" />
                <div className="shrink-0 w-20 text-right">Re-publish?</div>
              </div>
              <div className="divide-y divide-amber-500/10">
                {attentionLaptops.map((laptop) => {
                  const nowAvailable = laptop.availability && !isUnavailable(laptop.availability);
                  return (
                    <div key={laptop.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{laptop.name}</p>
                        {laptop.brand && (
                          <p className="text-xs text-muted-foreground">{laptop.brand}</p>
                        )}
                      </div>
                      <div className="shrink-0 w-10 sm:w-36 flex justify-center">
                        <StatusBadge
                          availability={laptop.availability}
                          lastChecked={laptop.last_checked}
                        />
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground w-20 sm:w-24 text-right">
                        {formatDate(laptop.last_checked)}
                      </div>
                      <div className="shrink-0 w-7 flex justify-center">
                        <AmazonLink url={laptop.amazon_affiliate_url} />
                      </div>
                      <div className="shrink-0 w-7 flex justify-center">
                        <button
                          onClick={() => refresh(laptop.id, [laptop.id])}
                          disabled={anyBusy}
                          title="Check again on Amazon"
                          className="p-1 rounded-md hover:bg-amber-500/10 text-amber-600 hover:text-amber-700 dark:text-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${busy === laptop.id ? "animate-spin" : ""}`}
                          />
                        </button>
                      </div>
                      <div className="shrink-0 w-20 flex items-center justify-end gap-1.5">
                        {nowAvailable && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Back in stock!
                          </span>
                        )}
                        <button
                          onClick={() => republish(laptop.id)}
                          disabled={republishingId === laptop.id}
                          className="h-6 px-2 text-xs font-medium rounded-md border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {republishingId === laptop.id ? "…" : "Publish"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="glass-card rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {publishedLaptops.length} published laptop{publishedLaptops.length !== 1 ? "s" : ""}.
          Refresh hits Amazon at ~1/sec.
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh("page", pageIds)}
            disabled={anyBusy || pageIds.length === 0}
            className="inline-flex items-center gap-2 rounded-[min(var(--radius-md),12px)] h-8 px-3 text-sm font-medium border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${busy === "page" ? "animate-spin" : ""}`} />
            {busy === "page" ? "Refreshing…" : `Refresh this page (${pageIds.length})`}
          </button>
          <button
            onClick={() => refresh("all")}
            disabled={anyBusy}
            className="inline-flex items-center gap-2 rounded-[min(var(--radius-md),12px)] h-8 px-3 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${busy === "all" ? "animate-spin" : ""}`} />
            {busy === "all" ? "Refreshing…" : `Refresh all (${publishedLaptops.length})`}
          </button>
        </div>
      </div>

      {/* Result log */}
      {result && (
        <div className="glass-card rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-sm font-medium text-foreground">
              Updated {result.updated} of {result.total} laptops
            </span>
            {result.failed > 0 && (
              <span className="ml-auto text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                {result.failed} failed
              </span>
            )}
          </div>
          {result.errors.length > 0 && (
            <ul className="space-y-1.5 border-t border-border/30 pt-3">
              {result.errors.map((e, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="glass-card rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-px" />
          <span className="text-sm text-red-400">{errorMsg}</span>
        </div>
      )}

      {/* Published laptops table */}
      <div className="glass-card rounded-xl border overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <div className="flex-1 min-w-0">Name</div>
          <div className="shrink-0 w-24 text-right">Price</div>
          <div className="shrink-0 w-10 sm:w-44 text-center">
            <span className="hidden sm:inline">Status</span>
          </div>
          <div className="shrink-0 w-20 sm:w-24 text-right">Last checked</div>
          <div className="shrink-0 w-7" title="Amazon">
            <ExternalLink className="w-3 h-3 mx-auto opacity-50" />
          </div>
          <div className="shrink-0 w-7" />
        </div>

        <div className="divide-y divide-border/20">
          {pageLaptops.map((laptop) => {
            const isExpanded = expandedId === laptop.id;
            return (
              <div key={laptop.id}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/10 transition-colors select-none"
                  onClick={() => setExpandedId(isExpanded ? null : laptop.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{laptop.name}</p>
                  </div>
                  <div className="shrink-0 text-sm font-medium text-foreground w-24 text-right">
                    {laptop.price_label ?? <span className="text-muted-foreground/50">—</span>}
                  </div>
                  <div className="shrink-0 w-10 sm:w-44 flex justify-center">
                    <StatusBadge
                      availability={laptop.availability}
                      lastChecked={laptop.last_checked}
                    />
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground w-20 sm:w-24 text-right">
                    {formatDate(laptop.last_checked)}
                  </div>
                  <div className="shrink-0 w-7 flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <AmazonLink url={laptop.amazon_affiliate_url} />
                  </div>
                  <div className="shrink-0 w-7 flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => refresh(laptop.id, [laptop.id])}
                      disabled={anyBusy}
                      title="Refresh this laptop"
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${busy === laptop.id ? "animate-spin" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Expanded detail row */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-0 bg-muted/5 border-t border-border/10 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
                    {laptop.brand && (
                      <span><span className="font-medium text-foreground">Brand:</span> {laptop.brand}</span>
                    )}
                    {laptop.availability && (
                      <span><span className="font-medium text-foreground">Availability:</span> {laptop.availability}</span>
                    )}
                    {laptop.amazon_affiliate_url && (
                      <a
                        href={laptop.amazon_affiliate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Check on Amazon
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border/30">
            <span className="text-xs text-muted-foreground">
              {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, publishedLaptops.length)} of{" "}
              {publishedLaptops.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <span className="text-xs text-muted-foreground px-1">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
