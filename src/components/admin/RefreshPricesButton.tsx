"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

type RefreshResult = {
  total: number;
  updated: number;
  failed: number;
  errors: string[];
};

export function RefreshPricesButton() {
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
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleRefresh}
        disabled={state === "loading"}
        className="inline-flex items-center gap-1.5 rounded-[min(var(--radius-md),12px)] h-7 px-2.5 text-[0.8rem] font-medium border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${state === "loading" ? "animate-spin" : ""}`} />
        {state === "loading" ? "Refreshing…" : "Refresh Prices"}
      </button>

      {state === "done" && result && (
        <div className="w-72 rounded-xl border bg-card p-3 text-xs space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium text-foreground">
              Updated {result.updated} of {result.total} laptops
            </span>
            {result.failed > 0 && (
              <span className="ml-auto text-amber-500 font-medium">{result.failed} failed</span>
            )}
          </div>

          {result.errors.length > 0 && (
            <ul className="space-y-1 border-t border-border/30 pt-2">
              {result.errors.map((e, i) => (
                <li key={i} className="flex gap-1.5 text-muted-foreground leading-snug">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="w-72 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-px" />
          <span className="text-red-400">{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
