"use client";

import { useState } from "react";
import { ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlogAgentDraftRecord } from "@/lib/blog-agent/types";
import type { PersonaOption } from "@/lib/personas/types";
import type { ResearchPacketRow } from "@/lib/research-calendar/types";

interface Props {
  initialPackets: ResearchPacketRow[];
  initialArtifacts: BlogAgentDraftRecord[];
  personas: PersonaOption[];
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClass(status: BlogAgentDraftRecord["status"]): string {
  if (status === "needs_review" || status === "generated") return "text-emerald-500";
  if (status === "failed" || status === "quality_blocked") return "text-destructive";
  return "text-muted-foreground";
}

export function BlogDraftQueue({
  initialPackets,
  initialArtifacts,
  personas,
}: Props) {
  const [packets, setPackets] = useState(initialPackets);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [personaByPacket, setPersonaByPacket] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/admin/growth-agents/blog/drafts");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not refresh the queue.");
    setPackets(data.packets);
    setArtifacts(data.artifacts);
  }

  async function generate(packetId: string) {
    setBusy(packetId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/growth-agents/blog/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          researchPacketId: packetId,
          personaId: personaByPacket[packetId] || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Draft generation failed.");
      setMessage(data.outcome.message);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Draft generation failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-medium text-foreground">Review-only workflow</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Generation checks evidence, structure, unsupported price patterns, and
          author disclosure. Passing content is saved as AI-generated, never published.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
      )}
      {message && (
        <p className="rounded-lg bg-primary/10 p-3 text-xs text-primary">{message}</p>
      )}

      <section className="glass-card space-y-3 rounded-xl border p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ready research packets</h2>
          <p className="text-xs text-muted-foreground">
            A manual persona selection overrides the deterministic selector.
          </p>
        </div>
        {packets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No research packets are ready for drafting.</p>
        ) : (
          <div className="space-y-3">
            {packets.map((packet) => (
              <article key={packet.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{packet.topic_title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{packet.topic_angle}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {packet.content_type} · confidence {packet.confidence_score}/100 · {packet.source_refs_json.length} source(s)
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:min-w-60">
                    <select
                      className="h-9 rounded-md border border-input bg-background/50 px-2 text-xs"
                      value={personaByPacket[packet.id] ?? ""}
                      onChange={(event) =>
                        setPersonaByPacket((current) => ({
                          ...current,
                          [packet.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Auto-select persona</option>
                      {personas.map((persona) => (
                        <option key={persona.id} value={persona.id}>
                          {persona.displayName}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={Boolean(busy)}
                      onClick={() => generate(packet.id)}
                    >
                      {busy === packet.id && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Generate review draft
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card space-y-3 rounded-xl border p-5">
        <h2 className="text-sm font-semibold text-foreground">Recent generation artifacts</h2>
        {artifacts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No draft runs yet.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {artifacts.slice(0, 20).map((artifact) => (
              <div key={artifact.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 py-3 text-xs">
                <span className={`font-medium ${statusClass(artifact.status)}`}>
                  {artifact.status.replaceAll("_", " ")}
                </span>
                <span className="text-muted-foreground">
                  Quality {artifact.quality_score ?? "—"}/{artifact.quality_threshold}
                </span>
                <span className="text-muted-foreground">{formatDate(artifact.created_at)}</span>
                {artifact.blog_post_id && (
                  <a
                    className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                    href={`/admin/blog/${artifact.blog_post_id}`}
                  >
                    Review draft <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {artifact.error_message && (
                  <p className="w-full text-destructive">{artifact.error_message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
