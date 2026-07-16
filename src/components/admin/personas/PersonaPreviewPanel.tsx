"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BlogAuthorPersona, PersonaPreviewResult } from "@/lib/personas/types";

export function PersonaPreviewPanel({ persona }: { persona: BlogAuthorPersona }) {
  const [topic, setTopic] = useState("How much RAM does a college student really need?");
  const [result, setResult] = useState<PersonaPreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/personas/${persona.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const json = await response.json();
      if (!response.ok) setError(json.error ?? "Preview failed.");
      else setResult(json.preview);
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      <div className="glass-card rounded-xl border p-5 space-y-4">
        <div><h2 className="text-sm font-semibold">Writing sample</h2><p className="text-xs text-muted-foreground">The API uses non-persistent generation when available and a deterministic local fallback otherwise.</p></div>
        <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4} className="bg-background/50" />
        <Button onClick={generate} disabled={busy || topic.trim().length < 3} className="gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate sample
        </Button>
        {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}
        {result && <div className="rounded-xl border border-primary/20 bg-primary/5 p-5"><p className="text-sm leading-7 text-foreground">{result.text}</p><p className="mt-3 text-[11px] text-muted-foreground">{result.usedAi ? `AI preview · ${result.model}` : "Deterministic fallback preview"}</p></div>}
      </div>
      <aside className="glass-card rounded-xl border p-5 h-fit space-y-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary">{persona.displayName.charAt(0)}</div>
        <div><p className="font-semibold">{persona.displayName}</p><p className="text-sm text-primary">{persona.publicRole}</p></div>
        <p className="text-sm text-muted-foreground leading-relaxed">{persona.shortBio}</p>
        <p className="text-xs rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 p-3">{persona.disclosureText}</p>
      </aside>
    </div>
  );
}
