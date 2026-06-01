"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ProcessedLaptopInput } from "@/lib/types";

interface ProcessWithAIProps {
  onProcessed: (data: ProcessedLaptopInput) => void;
}

export function ProcessWithAI({ onProcessed }: ProcessWithAIProps) {
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!rawInput.trim()) return;
    setLoading(true);
    setError(null);

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
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium text-foreground">Process with AI</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste raw Amazon product details or copied specifications. AI will extract and structure the
        laptop data. Review all fields before saving.
      </p>
      <div className="space-y-1.5">
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

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</p>
      )}

      <Button
        onClick={handleProcess}
        disabled={loading || !rawInput.trim()}
        size="sm"
        className="gap-2 bg-primary text-primary-foreground hover:opacity-90"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {loading ? "Processing…" : "Extract specs with AI"}
      </Button>

      {loading && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Sending to OpenAI for extraction. This usually takes 5–15 seconds…
        </p>
      )}
    </div>
  );
}
