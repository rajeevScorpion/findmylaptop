"use client";

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { Bot, X, Send, ArrowRight, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOMAINS, DOMAIN_ORDER, type DomainId } from "@/lib/domains";
import { requestChipHandoff } from "@/lib/chip-handoff";

// Chip's stand-in for the discipline-agnostic pages (home hub, blog index,
// articles, author pages). It wears the same shell as the real ChatWidget so it
// reads as one continuous assistant, but it holds exactly one question: which
// discipline are you in?
//
// That question is not filler. Chip's persona, cheat-sheet and laptop catalog
// are all domain-scoped (see lib/domains.ts), so an answer given without a
// domain would be generic at best and wrong at worst.
//
// Typing is live, though — whatever is in the box travels with the discipline
// they pick and is sent for them on arrival (see lib/chip-handoff.ts), so the
// question is a redirect rather than a toll gate. Nothing here calls /api/chat
// or touches the catalog: the router costs no fetches and no tokens.

/** Clearance for the fixed top nav, so the header never tucks under it. */
const TOP_GAP = 64;
const BOTTOM_GAP = 12;
/** Resting distance above the viewport bottom — clears the floating trigger. */
const RESTING_GAP = 178;

export function ChipDomainRouter({ enabledIds }: { enabledIds: DomainId[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const [pending, setPending] = useState<DomainId | null>(null);
  const [draft, setDraft] = useState("");
  const [nudged, setNudged] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // `chip_opened` is shared with the real widget, so the hint arrow and ping
  // stop once the visitor has met Chip anywhere on the site.
  const open = useCallback(() => {
    setIsOpen(true);
    setHasBeenOpened(true);
    try {
      localStorage.setItem("chip_opened", "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem("chip_opened") === "1") setHasBeenOpened(true);
    } catch {}

    // Answers the same `chip:open` contract the real widget uses, so the
    // existing "Chat with Chip" CTAs work unchanged on these pages.
    document.addEventListener("chip:open", open);
    return () => document.removeEventListener("chip:open", open);
  }, [open]);

  // Mobile keyboard awareness. The panel is `position: fixed`, which anchors to
  // the layout viewport — and on iOS Safari that does not shrink when the
  // on-screen keyboard appears, so a panel resting 178px up would sit behind it
  // with the discipline buttons out of reach. Track the visualViewport (the
  // region actually visible) and lift the panel clear of the keyboard.
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [viewport, setViewport] = useState<{
    /** Layout-viewport pixels the keyboard covers. Zero where the layout shrinks instead. */
    keyboardInset: number;
    visibleHeight: number;
    keyboardUp: boolean;
  } | null>(null);
  // The tallest visible height seen while open — anything well short of it means
  // the keyboard is up, on browsers that shrink the layout viewport and on those
  // that overlay it alike.
  const baselineHeightRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobileViewport(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!isOpen || !vv) {
      baselineHeightRef.current = 0;
      setViewport(null);
      return;
    }
    const update = () => {
      baselineHeightRef.current = Math.max(baselineHeightRef.current, vv.height);
      const layoutHeight = document.documentElement.clientHeight;
      setViewport({
        keyboardInset: Math.max(0, layoutHeight - (vv.offsetTop + vv.height)),
        visibleHeight: vv.height,
        keyboardUp: vv.height < baselineHeightRef.current - 120,
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [isOpen]);

  // Desktop only: the primary action here is picking a discipline, so stealing
  // focus on mobile — and throwing the keyboard over the choices — would be
  // exactly backwards.
  useEffect(() => {
    if (isOpen && !isMobileViewport) {
      const t = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [isOpen, isMobileViewport]);

  function choose(id: DomainId) {
    if (pending) return;
    setPending(id);
    requestChipHandoff(id, draft);
    router.push(DOMAINS[id].route);
  }

  /** Enter/Send can't answer anything yet — point at what's still missing. */
  function nudge() {
    if (!draft.trim() || pending) return;
    setNudged(true);
  }

  const choices = DOMAIN_ORDER.filter((d) => enabledIds.includes(d.id));
  if (choices.length === 0) return null;

  // With a single live domain there is no choice to make — the question would be
  // theatre, so Chip just offers the door.
  const only = choices.length === 1 ? choices[0] : null;
  const hasDraft = draft.trim().length > 0;

  const greeting = only
    ? `Hi! I'm Chip 👋 I match ${only.label.toLowerCase()} students and professionals to laptops built for the work they actually do.\n\nAsk me anything — or step straight into the ${only.label} page.`
    : "Hi! I'm Chip 👋 The right laptop depends entirely on what you study or do — so before I answer, tell me which world you're in.\n\nType your question if you have one; I'll carry it over and answer it there.";

  let footnote: string;
  if (pending) {
    footnote = `Taking you to ${DOMAINS[pending].label}…`;
  } else if (hasDraft) {
    footnote = "Pick a discipline and I'll answer this on the other side — you won't have to retype it.";
  } else {
    footnote = "Choosing opens that discipline's page with Chip ready and waiting.";
  }

  // Lift clear of the keyboard on mobile; otherwise rest above the trigger.
  let panelStyle: CSSProperties | undefined;
  if (isMobileViewport && viewport) {
    const bottom = viewport.keyboardUp ? viewport.keyboardInset + BOTTOM_GAP : RESTING_GAP;
    panelStyle = {
      bottom,
      // How far the panel's bottom edge sits above the *visible* bottom, which
      // is what the remaining height has to be measured against.
      maxHeight: viewport.visibleHeight - TOP_GAP - (bottom - viewport.keyboardInset),
    };
  }

  return (
    <LazyMotion features={domAnimation}>
      {/* ── Backdrop — mobile only, matching the real widget ── */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[39] bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Hand-drawn hint arrow (disappears after first open) ── */}
      {!hasBeenOpened && (
        <div
          className="fixed bottom-[196px] right-[28px] z-40 pointer-events-none select-none"
          style={{ fontFamily: "var(--font-handwriting, 'Caveat', cursive)" }}
        >
          <p className="text-[19px] text-foreground/70 text-right leading-snug drop-shadow-sm">
            Find your<br />perfect laptop!
          </p>
        </div>
      )}

      {/* ── Floating Chip trigger button ── */}
      <div className="fixed bottom-[116px] right-4 z-40 w-12 h-12">
        {!hasBeenOpened && (
          <span className="absolute inset-0 rounded-full animate-ping bg-violet-400/40 pointer-events-none" />
        )}
        <button
          onClick={open}
          aria-label="Open Chip laptop advisor"
          className="absolute right-0 group h-12 w-12 hover:w-[130px] overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 flex items-center transition-[width] duration-300 ease-in-out"
        >
          <span className="text-xs font-semibold whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[78px] transition-[max-width] duration-300 pl-0 group-hover:pl-4">
            Ask Chip
          </span>
          <span className="flex-none flex items-center justify-center w-12 h-12 ml-auto">
            <Bot className="w-[18px] h-[18px]" />
          </span>
        </button>
      </div>

      {/* ── Picker window ── */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            style={panelStyle}
            className="fixed bottom-[178px] right-4 z-[40] flex w-80 md:w-96 max-h-[min(560px,calc(100dvh-210px))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            {/* Header — identical to the real widget, minus the maximise control
                (there is nothing here worth a full screen). */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-gradient-to-r from-violet-500/10 to-indigo-600/10 shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">Chip</p>
                <p className="text-[11px] text-muted-foreground leading-tight">Laptop advisor</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Greeting + the one question */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {greeting}
              </div>

              {nudged && (
                <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs leading-relaxed text-foreground">
                  Almost — which discipline is that for? Pick one and I&apos;ll answer it there.
                </div>
              )}

              <div className="mr-2 space-y-2">
                {choices.map((d) => (
                  <button
                    key={d.id}
                    data-domain={d.id}
                    onClick={() => choose(d.id)}
                    disabled={pending !== null}
                    className={cn(
                      "group w-full rounded-xl border bg-background/60 px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50",
                      nudged ? "border-primary/50 ring-1 ring-primary/30" : "border-border/60"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {hasDraft ? `Ask ${d.label}` : only ? `Take me to ${d.label}` : d.label}
                      </span>
                      {pending === d.id ? (
                        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-primary" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                      )}
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                      {d.hubBlurb}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mr-2 text-[10px] leading-relaxed text-muted-foreground/70">{footnote}</p>
            </div>

            {/* Input — live. Nothing is sent from here; the draft rides along with
                whichever discipline they pick. */}
            <div className="px-3 py-2.5 border-t border-border/40 shrink-0">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (nudged) setNudged(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      nudge();
                    }
                  }}
                  disabled={pending !== null}
                  maxLength={2000}
                  rows={1}
                  placeholder="Ask Chip…"
                  className="flex-1 min-h-8 max-h-24 resize-none text-xs py-2 rounded-xl border-border/60 bg-background/50"
                />
                <Button
                  onClick={nudge}
                  disabled={!hasDraft || pending !== null}
                  size="sm"
                  aria-label="Send"
                  className="shrink-0 h-8 w-8 p-0 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="mt-1.5 px-1 text-[9px] leading-relaxed text-muted-foreground/70">
                Anonymous chats are stored temporarily for quality review. Don&apos;t
                share names, contact details, or other sensitive information.
              </p>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
