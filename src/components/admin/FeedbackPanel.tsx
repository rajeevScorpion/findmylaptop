"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, ArrowLeft, MessagesSquare } from "lucide-react";

export interface FeedbackRow {
  id: string;
  session_id: string;
  domain: "design" | "technology" | "management";
  rating: boolean | null;
  comment: string | null;
  transcript: { role: string; content: string }[] | null;
  recommended_slugs: string[];
  message_count: number;
  created_at: string;
}

const DOMAIN_BADGE: Record<FeedbackRow["domain"], { label: string; cls: string }> = {
  design: { label: "Design", cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  technology: { label: "Technology", cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  management: { label: "Management", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
};

function DomainBadge({ domain }: { domain: FeedbackRow["domain"] }) {
  const d = DOMAIN_BADGE[domain] ?? DOMAIN_BADGE.design;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${d.cls}`}>
      {d.label}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function RatingIcon({ rating, size = "sm" }: { rating: boolean | null; size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-7 h-7" : "w-6 h-6";
  const icon = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";
  const tone =
    rating === true
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : rating === false
        ? "bg-red-500/15 text-red-500"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`shrink-0 flex items-center justify-center ${dim} rounded-full ${tone}`}>
      {rating === true ? (
        <ThumbsUp className={icon} />
      ) : rating === false ? (
        <ThumbsDown className={icon} />
      ) : (
        <MessagesSquare className={icon} />
      )}
    </span>
  );
}

function TranscriptView({ row, onBack }: { row: FeedbackRow; onBack?: () => void }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 shrink-0 flex items-start gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="shrink-0 mt-0.5 p-1 -ml-1 rounded-lg hover:bg-muted transition-colors"
            aria-label="Back to list"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        <RatingIcon rating={row.rating} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">
            {row.comment
              ? `"${row.comment}"`
              : <span className="text-muted-foreground font-normal italic">
                  {row.rating === null ? "Not rated" : "No comment left"}
                </span>}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] text-muted-foreground">
              {row.message_count} messages · {timeAgo(row.created_at)}
            </p>
            <DomainBadge domain={row.domain} />
          </div>
          {row.recommended_slugs.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {row.recommended_slugs.map((slug) => (
                <span key={slug} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                  {slug}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
        {row.transcript && row.transcript.length > 0 ? (
          row.transcript.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary/15 text-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center pt-8">No transcript saved.</p>
        )}
      </div>
    </div>
  );
}

export function FeedbackPanel({ feedback }: { feedback: FeedbackRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    feedback.length > 0 ? feedback[0].id : null
  );
  // Mobile: when a session is tapped, show transcript view
  const [mobileView, setMobileView] = useState<"list" | "transcript">("list");

  const selected = feedback.find((f) => f.id === selectedId) ?? null;

  if (feedback.length === 0) {
    return (
      <div className="glass-card rounded-xl border p-10 text-center text-muted-foreground text-sm">
        No conversations yet. Once someone chats with Chip, it will appear here.
      </div>
    );
  }

  const SessionList = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-border/30 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          Sessions · {feedback.length}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border/20">
        {feedback.map((row) => {
          const isActive = row.id === selectedId;
          return (
            <button
              key={row.id}
              onClick={() => {
                setSelectedId(row.id);
                setMobileView("transcript");
              }}
              className={`w-full text-left flex items-start gap-2.5 px-4 py-3.5 transition-colors border-l-2 ${
                isActive
                  ? "bg-primary/8 border-primary"
                  : "border-transparent hover:bg-muted/30"
              }`}
            >
              <RatingIcon rating={row.rating} />
              <div className="flex-1 min-w-0">
                {row.comment ? (
                  <p className="text-xs text-foreground leading-snug line-clamp-2">"{row.comment}"</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {row.rating === null ? "Not rated" : "No comment"}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <MessageSquare className="w-2.5 h-2.5 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground">{row.message_count} msgs</span>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(row.created_at)}</span>
                  <DomainBadge domain={row.domain} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile: list or transcript (stacked, not side-by-side) ── */}
      <div className="lg:hidden glass-card rounded-xl border overflow-hidden" style={{ height: "calc(100svh - 220px)", minHeight: 420 }}>
        {mobileView === "list" || !selected ? (
          <SessionList />
        ) : (
          <TranscriptView
            row={selected}
            onBack={() => setMobileView("list")}
          />
        )}
      </div>

      {/* ── Desktop: two-column side by side ── */}
      <div className="hidden lg:flex glass-card rounded-xl border overflow-hidden" style={{ height: "calc(100vh - 240px)", minHeight: 420 }}>
        {/* Left list */}
        <div className="w-72 shrink-0 border-r border-border/30 flex flex-col">
          <SessionList />
        </div>

        {/* Right transcript */}
        <div className="flex-1 flex flex-col min-w-0">
          {selected ? (
            <TranscriptView row={selected} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a session to view its transcript
            </div>
          )}
        </div>
      </div>
    </>
  );
}
