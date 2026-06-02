"use client";

import { useState } from "react";
import { Sparkles, Loader2, Link, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ProcessedLaptopInput } from "@/lib/types";

interface ProcessWithAIProps {
  onProcessed: (data: ProcessedLaptopInput) => void;
}

export function ProcessWithAI({ onProcessed }: ProcessWithAIProps) {
  const [urlInput, setUrlInput] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlApiInactive, setUrlApiInactive] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    setUrlError(null);
    setUrlApiInactive(false);

    try {
      const res = await fetch("/api/admin/fetch-amazon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (body.code === "API_NOT_ACTIVE") {
          setUrlApiInactive(true);
        } else {
          setUrlError(body.error ?? `Server error ${res.status}`);
        }
        return;
      }

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
        body: JSON.stringify({ rawInput }),
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
            }}
            placeholder="https://www.amazon.in/dp/B0XXXXXXXX"
            className="bg-background/60 text-xs h-8 flex-1"
          />
          <Button
            onClick={handleFetchUrl}
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
