"use client";

import { Bot } from "lucide-react";

// The home hub's invitation to Chip. A button rather than a label, because on
// the hub Chip is the domain router — this is the visitor's first chance to pick
// a discipline, and the pill sits right above the domain cards that ask the same
// question.
export function ChipInvite() {
  return (
    <button
      onClick={() => document.dispatchEvent(new CustomEvent("chip:open"))}
      className="inline-flex items-center gap-2 rounded-full glass-card border px-4 py-2.5 text-xs sm:text-sm text-muted-foreground/80 transition-colors hover:border-violet-500/40 hover:text-foreground"
    >
      <Bot className="w-4 h-4 shrink-0 text-violet-500" />
      <span className="text-balance">Meet Chip — pick a discipline and start chatting.</span>
    </button>
  );
}
