"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Circle } from "lucide-react";

type Laptop = {
  id: string;
  name: string;
  brand?: string | null;
  price_label?: string | null;
  availability?: string | null;
  last_checked?: string | null;
  amazon_affiliate_url?: string | null;
};

type RefreshResult = {
  total: number;
  updated: number;
  failed: number;
  errors: string[];
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AvailabilityBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground/50">—</span>;

  const lower = value.toLowerCase();
  const isInStock = lower.includes("in stock") || lower === "now";
  const isOutOfStock = lower.includes("out of stock");

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${
        isInStock
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : isOutOfStock
          ? "bg-red-500/10 text-red-600 dark:text-red-400"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      }`}
    >
      <Circle className="w-1.5 h-1.5 fill-current" />
      {value}
    </span>
  );
}

export function RefreshPricesPanel({ laptops }: { laptops: Laptop[] }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleRefresh() {
    setState("loading");
    setResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/refresh-prices", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Unknown error");
        setState("error");
        return;
      }

      setResult(data);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setState("error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="glass-card rounded-xl border p-4 flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {laptops.length} published laptop{laptops.length !== 1 ? "s" : ""} will be checked.
          Takes ~{Math.ceil(laptops.length * 1.1)}s.
        </div>
        <button
          onClick={handleRefresh}
          disabled={state === "loading"}
          className="inline-flex items-center gap-2 rounded-[min(var(--radius-md),12px)] h-8 px-3 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${state === "loading" ? "animate-spin" : ""}`} />
          {state === "loading" ? "Refreshing…" : "Refresh Now"}
        </button>
      </div>

      {/* Result log */}
      {state === "done" && result && (
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

      {state === "error" && (
        <div className="glass-card rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-px" />
          <span className="text-sm text-red-400">{errorMsg}</span>
        </div>
      )}

      {/* Laptop table */}
      <div className="glass-card rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30">
          <p className="text-sm font-medium text-foreground">Current data</p>
        </div>
        <div className="divide-y divide-border/20">
          {laptops.map((laptop) => (
            <div key={laptop.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{laptop.name}</p>
              </div>
              <div className="shrink-0 text-sm font-medium text-foreground w-24 text-right">
                {laptop.price_label ?? <span className="text-muted-foreground/50">—</span>}
              </div>
              <div className="shrink-0 w-28 flex justify-center">
                <AvailabilityBadge value={laptop.availability} />
              </div>
              <div className="shrink-0 text-xs text-muted-foreground w-24 text-right">
                {formatDate(laptop.last_checked)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
