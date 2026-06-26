"use client";

import { useState } from "react";
import { Sparkles, Loader2, Link, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DOMAIN_ORDER, type DomainId } from "@/lib/domains";
import type { ProcessedLaptopInput } from "@/lib/types";
import type { DuplicateCandidate } from "@/lib/duplicate-detection";

interface DuplicateInfo {
  message: string;
  candidates: DuplicateCandidate[];
}

interface ProcessWithAIProps {
  onProcessed: (data: ProcessedLaptopInput) => void;
  /** Active domain — steers the extraction prompt's reasoning per audience. */
  domain: DomainId;
  onDomainChange: (domain: DomainId) => void;
  /** When provided, clicking a suggested duplicate previews it in place rather
   *  than opening its edit page in a new tab. */
  onPreviewDuplicate?: (id: string) => void;
}

export function ProcessWithAI({ onProcessed, domain, onDomainChange, onPreviewDuplicate }: ProcessWithAIProps) {
  const [urlInput, setUrlInput] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlApiInactive, setUrlApiInactive] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateInfo | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  // `force` skips the duplicate gate — used by "Add anyway" after the admin has
  // reviewed the suggested duplicates and confirmed this is a distinct laptop.
  const handleFetchUrl = async (force = false) => {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    setUrlError(null);
    setUrlApiInactive(false);
    if (!force) setDuplicates(null);

    try {
      const res = await fetch("/api/admin/fetch-amazon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim(), domain, force }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (body.code === "API_NOT_ACTIVE") {
          setUrlApiInactive(true);
        } else if (body.code === "DUPLICATE_FOUND") {
          setDuplicates({ message: body.message, candidates: body.candidates ?? [] });
        } else {
          setUrlError(body.error ?? `Server error ${res.status}`);
        }
        return;
      }

      setDuplicates(null);
      onProcessed(body as ProcessedLaptopInput);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setUrlLoading(false);
    }
  };

  const handleProcessText = async () => {
    if (!rawInput.trim()) return;
    setTextLoading(true);
    setTextError(null);

    try {
      const res = await fetch("/api/admin/process-laptop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput, domain }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      const data: ProcessedLaptopInput = await res.json();
      onProcessed(data);
    } catch (err) {
      setTextError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setTextLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 rounded-xl bg-primary/5 border border-primary/15">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium text-foreground">Process with AI</p>
      </div>

      {/* Domain — picked before extracting so the AI reasons for the right audience */}
      <div className="space-y-1.5">
        <Label className="text-xs">Domain</Label>
        <div className="flex flex-wrap gap-2">
          {DOMAIN_ORDER.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onDomainChange(d.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                domain === d.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          Pick this first — the AI tailors its reasoning, course tags, and verdict to this audience.
        </p>
      </div>

      {/* URL fetch */}
      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          <Link className="w-3 h-3" />
          Amazon product URL
        </Label>
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setUrlError(null);
              setUrlApiInactive(false);
              setDuplicates(null);
            }}
            placeholder="https://www.amazon.in/dp/B0XXXXXXXX"
            className="bg-background/60 text-xs h-8 flex-1"
          />
          <Button
            onClick={() => handleFetchUrl()}
            disabled={urlLoading || !urlInput.trim()}
            size="sm"
            className="gap-1.5 h-8 shrink-0 bg-primary text-primary-foreground hover:opacity-90"
          >
            {urlLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {urlLoading ? "Fetching…" : "Fetch & Extract"}
          </Button>
        </div>

        {urlApiInactive && (
          <div className="flex gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Amazon Creators API requires 10 qualifying sales in the last 30 days. Your account isn&apos;t active yet — paste product details manually below.
            </span>
          </div>
        )}

        {duplicates && (
          <div className="space-y-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
            <div className="flex gap-2 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{duplicates.message} Edit the existing entry instead of adding a duplicate.</span>
            </div>

            <ul className="space-y-1.5 pl-5">
              {duplicates.candidates.map((c) => (
                <li key={c.id} className="text-xs flex items-center gap-2 flex-wrap">
                  {onPreviewDuplicate ? (
                    <button
                      type="button"
                      onClick={() => onPreviewDuplicate(c.id)}
                      className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
                    >
                      {c.name}
                    </button>
                  ) : (
                    <a
                      href={`/admin/laptops/${c.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline underline-offset-2"
                    >
                      {c.name}
                    </a>
                  )}
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[10px] uppercase tracking-wide">
                    {c.match === "exact-asin"
                      ? "Same ASIN"
                      : `Similar name (${Math.round(c.score * 100)}%)`}
                  </span>
                </li>
              ))}
            </ul>

            <div className="pl-5">
              <Button
                onClick={() => handleFetchUrl(true)}
                disabled={urlLoading}
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/10"
              >
                {urlLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Not a duplicate — add anyway"
                )}
              </Button>
            </div>
          </div>
        )}

        {urlError && (
          <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{urlError}</p>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border/40" />
        <span className="text-xs text-muted-foreground/60">or paste manually</span>
        <div className="flex-1 h-px bg-border/40" />
      </div>

      {/* Manual paste */}
      <div className="space-y-2">
        <Label htmlFor="rawInput" className="text-xs">Pasted product details</Label>
        <Textarea
          id="rawInput"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          rows={6}
          placeholder="Paste Amazon product title, bullet points, specifications table, or any rough product details here…"
          className="bg-background/60 text-xs resize-y"
        />
      </div>

      {textError && (
        <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{textError}</p>
      )}

      <Button
        onClick={handleProcessText}
        disabled={textLoading || !rawInput.trim()}
        size="sm"
        className="gap-2 bg-primary text-primary-foreground hover:opacity-90"
      >
        {textLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {textLoading ? "Processing…" : "Extract specs with AI"}
      </Button>

      {(urlLoading || textLoading) && (
        <p className="text-xs text-muted-foreground animate-pulse">
          {urlLoading
            ? "Fetching product from Amazon, then extracting specs…"
            : "Sending to OpenAI for extraction. This usually takes 5–15 seconds…"}
        </p>
      )}
    </div>
  );
}
