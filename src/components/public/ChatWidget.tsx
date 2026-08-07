"use client";

import { useState, useEffect, useRef, useMemo, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X, Send, Maximize2, Minimize2, ThumbsUp, ThumbsDown, Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LaptopMiniCard } from "./LaptopMiniCard";
import { cn } from "@/lib/utils";
import type { Laptop, ChatMessage, ChatApiResponse } from "@/lib/types";
import { DOMAINS, type DomainId } from "@/lib/domains";
import { consumeChipHandoff } from "@/lib/chip-handoff";

// Conversation state is cached in sessionStorage, scoped PER DOMAIN so that
// switching domains (e.g. Technology → Design via the tabs) never restores the
// wrong domain's greeting/conversation. Each domain keeps its own independent
// chat + session + feedback state. `chip_opened` (the hint-arrow flag) stays
// global — it isn't conversation state.
const storageKeys = (domain: DomainId) => ({
  messages: `chip_messages_${domain}`,
  sessionId: `chip_session_id_${domain}`,
  rated: `chip_rated_${domain}`,
});

function makeInitialMessage(domain: DomainId): ChatMessage {
  const chip = DOMAINS[domain].chip;
  return {
    id: "greeting",
    role: "assistant",
    content: chip.greeting,
    recommendedSlugs: [],
    suggestions: chip.roleSuggestions,
    timestamp: 0,
  };
}

interface ChatWidgetProps {
  laptops: Laptop[];
  voiceEnabled?: boolean;
  domain?: DomainId;
}

export function ChatWidget({ laptops, voiceEnabled = true, domain = "design" }: ChatWidgetProps) {
  const initialMessage = useMemo(() => makeInitialMessage(domain), [domain]);
  const keys = useMemo(() => storageKeys(domain), [domain]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messagesRemaining, setMessagesRemaining] = useState(30);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  /** A question typed into the domain router before it navigated here. */
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mobile keyboard / address-bar aware sizing. On mobile the chat window is
  // `position: fixed`, which anchors to the layout viewport — that does NOT
  // shrink when the on-screen keyboard or address bar appears, so the header
  // gets pushed off-screen. We instead track the visualViewport (the region
  // actually visible) and size the window to fit within it.
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [viewport, setViewport] = useState<{ height: number; offsetTop: number } | null>(null);

  // Voice input
  type RecordingState = "idle" | "recording" | "transcribing";
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Feedback state
  type FeedbackStage = "prompt" | "comment" | "done";
  const [feedbackStage, setFeedbackStage] = useState<FeedbackStage | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<boolean | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);

  const hasRecommendation = useMemo(
    () => messages.some((m) => m.role === "assistant" && (m.recommendedSlugs?.length ?? 0) > 0),
    [messages]
  );

  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem(keys.messages);
      const savedSessionId = sessionStorage.getItem(keys.sessionId);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
      if (savedSessionId) setSessionId(savedSessionId);
      if (localStorage.getItem("chip_opened") === "1") setHasBeenOpened(true);
      if (sessionStorage.getItem(keys.rated) === "1") setFeedbackStage("done");
    } catch {}

    // Arriving from the domain router on a discipline-agnostic page (home hub,
    // blog): the visitor already answered "which discipline?", so pick the
    // conversation up here rather than making them find the bubble again.
    const handoff = consumeChipHandoff(domain);
    if (handoff) {
      setIsOpen(true);
      setHasBeenOpened(true);
      try { localStorage.setItem("chip_opened", "1"); } catch {}
      if (handoff.question) setPendingQuestion(handoff.question);
    }

    const handleOpenEvent = () => {
      setIsOpen(true);
      setHasBeenOpened(true);
      try { localStorage.setItem("chip_opened", "1"); } catch {}
    };
    document.addEventListener("chip:open", handleOpenEvent);
    return () => document.removeEventListener("chip:open", handleOpenEvent);
  }, [keys, domain]);

  useEffect(() => {
    try { sessionStorage.setItem(keys.messages, JSON.stringify(messages)); } catch {}
  }, [messages, keys]);

  useEffect(() => {
    if (sessionId) {
      try { sessionStorage.setItem(keys.sessionId, sessionId); } catch {}
    }
  }, [sessionId, keys]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isOpen]);

  // Show feedback prompt once the first recommendation appears (and not already rated)
  useEffect(() => {
    if (hasRecommendation && feedbackStage === null) {
      try {
        if (sessionStorage.getItem(keys.rated) !== "1") {
          setFeedbackStage("prompt");
        }
      } catch {
        setFeedbackStage("prompt");
      }
    }
  }, [hasRecommendation, feedbackStage, keys]);

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 100);
  }, [isOpen]);

  // Send the question the visitor typed into the domain router. Deliberately a
  // separate effect from the mount restore above: by the time this runs, the
  // saved conversation has been applied, so `sendMessage` appends to the real
  // history rather than to the greeting it was mounted with. Clearing the state
  // first makes a re-run a no-op, which is why `sendMessage` is not a dependency.
  useEffect(() => {
    if (!pendingQuestion) return;
    setPendingQuestion(null);
    sendMessage(pendingQuestion);
  }, [pendingQuestion]);

  // Track whether we're on a mobile-sized screen (matches the `md` breakpoint).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobileViewport(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Track the visualViewport so the window can clear the address bar + keyboard.
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!isOpen || !vv) return;
    const update = () => setViewport({ height: vv.height, offsetTop: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [isOpen]);

  // After "before you go" feedback resolves, close the window on a short beat
  useEffect(() => {
    if (pendingClose && feedbackStage === "done") {
      const t = setTimeout(() => reallyClose(), 900);
      return () => clearTimeout(t);
    }
  }, [pendingClose, feedbackStage]);

  const laptopBySlug = useMemo(
    () => Object.fromEntries(laptops.map((l) => [l.slug, l])),
    [laptops]
  );

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading || messagesRemaining === 0) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue("");
    setIsLoading(true);

    const historyToSend = updatedMessages
      .filter((m) => m.id !== "greeting")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyToSend, sessionId: sessionId ?? undefined, domain }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data: ChatApiResponse = await res.json();
      if (!sessionId) setSessionId(data.sessionId);
      setMessagesRemaining(data.messagesRemaining);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message,
          recommendedSlugs: data.recommendedSlugs,
          suggestions: data.suggestions,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          suggestions: ["Try again"],
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function transcribe(blob: Blob) {
    setRecordingState("transcribing");
    try {
      const form = new FormData();
      form.append("file", blob, "voice.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Transcribe error ${res.status}`);
      const data: { text?: string } = await res.json();
      const text = (data.text ?? "").trim();
      if (text) {
        // Magical mode: send straight to the chat — no extra taps.
        setRecordingState("idle");
        sendMessage(text);
        return;
      }
      setVoiceHint("Didn't catch that — try again.");
    } catch (err) {
      console.error("Transcription error:", err);
      setVoiceHint("Voice input failed — type instead.");
    } finally {
      setRecordingState("idle");
    }
  }

  async function startRecording() {
    setVoiceHint(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setVoiceHint("Voice input isn't supported here.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) transcribe(blob);
        else setRecordingState("idle");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingState("recording");
    } catch {
      setVoiceHint("Mic permission needed for voice input.");
      setRecordingState("idle");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }

  function toggleRecording() {
    if (recordingState === "recording") stopRecording();
    else if (recordingState === "idle") startRecording();
  }

  async function submitFeedback(rating: boolean, comment?: string) {
    if (!sessionId || feedbackSubmitting) return;
    setFeedbackSubmitting(true);

    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          rating,
          comment: comment?.trim() || undefined,
        }),
      });
      try { sessionStorage.setItem(keys.rated, "1"); } catch {}
    } catch {
      // non-critical — don't surface errors to user
    } finally {
      setFeedbackSubmitting(false);
      setFeedbackStage("done");
    }
  }

  function handleThumbsClick(positive: boolean) {
    setFeedbackRating(positive);
    setFeedbackStage("comment");
  }

  async function handleFeedbackSubmit() {
    await submitFeedback(feedbackRating!, feedbackComment);
  }

  async function handleFeedbackSkip() {
    await submitFeedback(feedbackRating!);
  }

  function reallyClose() {
    setIsOpen(false);
    setIsMaximized(false);
    setPendingClose(false);
  }

  function handleClose() {
    const engaged = messages.some((m) => m.role === "user");
    let alreadyHandled = feedbackStage === "done";
    try {
      if (sessionStorage.getItem(keys.rated) === "1") alreadyHandled = true;
    } catch {}

    if (engaged && !alreadyHandled) {
      // Intercept the close with a dismissible "before you go" feedback CTA
      setPendingClose(true);
      setFeedbackStage((prev) => (prev === null ? "prompt" : prev));
      return;
    }
    reallyClose();
  }

  // On mobile, override vertical positioning so the window always fits inside
  // the visible region (between the address bar and the keyboard). Horizontal
  // positioning / width keep coming from the Tailwind classes. Falls back to
  // the classes when visualViewport is unavailable.
  let mobileWindowStyle: CSSProperties | undefined;
  if (isMobileViewport && viewport) {
    // Reserve clearance for the fixed top nav (logo / Blog / theme toggle, z-50)
    // in BOTH modes so the chat header never tucks under it.
    const TOP_GAP = 64;
    const BOTTOM_GAP = 12;
    const available = viewport.height - TOP_GAP - BOTTOM_GAP;
    const height = isMaximized ? available : Math.min(520, available);
    mobileWindowStyle = {
      top: viewport.offsetTop + viewport.height - BOTTOM_GAP - height,
      height,
      bottom: "auto",
      maxHeight: "none",
    };
  }

  return (
    <>
      {/* ── Background blur overlay — mobile always, desktop when maximized ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed inset-0 bg-black/40 backdrop-blur-sm",
              isMaximized ? "z-[39]" : "z-[39] md:hidden"
            )}
            onClick={handleClose}
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
          onClick={() => {
            setIsOpen(true);
            setHasBeenOpened(true);
            try { localStorage.setItem("chip_opened", "1"); } catch {}
          }}
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

      {/* ── Chat window ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            style={mobileWindowStyle}
            className={cn(
              "z-[40] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden",
              isMaximized
                // Mobile: near-fullscreen, but top starts below the fixed top nav (logo / Blog / theme
                // toggle, all z-50) so the chat header + close button clear it. Desktop: centered column,
                // ~1/3 width, padded top/bottom.
                // mx-auto (not translate) centers it — framer sets an inline transform that would override translate-x.
                ? "fixed inset-x-3 top-16 bottom-3 md:inset-y-10 md:left-0 md:right-0 md:mx-auto md:w-1/3 md:min-w-[400px] md:max-w-[560px]"
                : "fixed bottom-[178px] right-4 w-80 md:w-96 h-[520px]"
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-gradient-to-r from-violet-500/10 to-indigo-600/10 shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">Chip</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{DOMAINS[domain].label} laptop advisor</p>
              </div>
              {/* Maximize / Minimize */}
              <button
                onClick={() => setIsMaximized((v) => !v)}
                aria-label={isMaximized ? "Minimise chat" : "Maximise chat"}
                className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                {isMaximized
                  ? <Minimize2 className="w-3.5 h-3.5" />
                  : <Maximize2 className="w-3.5 h-3.5" />
                }
              </button>
              {/* Close */}
              <button
                onClick={handleClose}
                aria-label="Close chat"
                className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* "Before you go" feedback overlay — shown when closing an engaged, unrated chat */}
            <AnimatePresence>
              {pendingClose && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-card/95 backdrop-blur-sm px-6"
                >
                  <div className="w-full max-w-[280px] text-center space-y-3">
                    {feedbackStage === "done" ? (
                      <p className="text-sm text-foreground">Thanks! 🙌 See you soon.</p>
                    ) : feedbackStage === "comment" ? (
                      <div className="space-y-2 text-left">
                        <p className="text-xs text-muted-foreground">
                          {feedbackRating ? "Glad to hear it! Anything we could do better?" : "Sorry about that. What went wrong?"}
                        </p>
                        <Textarea
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          placeholder="Optional..."
                          rows={2}
                          className="text-xs resize-none rounded-lg border-border/50 bg-background/50"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={handleFeedbackSkip}
                            disabled={feedbackSubmitting}
                            className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                          >
                            Skip
                          </button>
                          <button
                            onClick={handleFeedbackSubmit}
                            disabled={feedbackSubmitting}
                            className="text-[11px] px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                          >
                            {feedbackSubmitting ? "Sending…" : "Send"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-foreground">Before you go… 👋</p>
                        <p className="text-xs text-muted-foreground">Was Chip helpful?</p>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleThumbsClick(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border/50 hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            Yes
                          </button>
                          <button
                            onClick={() => handleThumbsClick(false)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border/50 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                            No
                          </button>
                        </div>
                        <button
                          onClick={reallyClose}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Skip &amp; close
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                        : "mr-auto bg-muted text-foreground rounded-bl-sm"
                    )}
                  >
                    {msg.content}
                  </div>

                  {msg.role === "assistant" &&
                    msg.recommendedSlugs &&
                    msg.recommendedSlugs.length > 0 && (
                      <div className="mt-2 space-y-2 mr-2">
                        {msg.recommendedSlugs.map((slug) => {
                          const laptop = laptopBySlug[slug];
                          if (!laptop) return null;
                          return <LaptopMiniCard key={slug} laptop={laptop} />;
                        })}
                      </div>
                    )}

                  {msg.role === "assistant" &&
                    msg.suggestions &&
                    msg.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 mr-2">
                        {msg.suggestions.map((s) => (
                          <button
                            key={s}
                            onClick={() => sendMessage(s)}
                            disabled={isLoading || messagesRemaining === 0}
                            className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 bg-background/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-1 items-center px-3 py-2 rounded-2xl rounded-bl-sm bg-muted w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {messagesRemaining <= 5 && messagesRemaining > 0 && (
              <div className="px-3 py-1.5 bg-amber-500/10 border-t border-amber-500/20 shrink-0">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 text-center">
                  {messagesRemaining} message{messagesRemaining !== 1 ? "s" : ""} remaining this session
                </p>
              </div>
            )}

            {/* Feedback strip — visible once at least one recommendation has appeared */}
            {hasRecommendation && feedbackStage !== null && (
              <div className="px-3 py-2 border-t border-border/30 bg-muted/30 shrink-0">
                {feedbackStage === "prompt" && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">Was Chip helpful?</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleThumbsClick(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border border-border/50 hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        Yes
                      </button>
                      <button
                        onClick={() => handleThumbsClick(false)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border border-border/50 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      >
                        <ThumbsDown className="w-3 h-3" />
                        No
                      </button>
                    </div>
                  </div>
                )}

                {feedbackStage === "comment" && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      {feedbackRating ? "Glad to hear it! Anything we could do better?" : "Sorry about that. What went wrong?"}
                    </p>
                    <Textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Optional..."
                      maxLength={2000}
                      rows={2}
                      className="text-xs resize-none rounded-lg border-border/50 bg-background/50"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={handleFeedbackSkip}
                        disabled={feedbackSubmitting}
                        className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                      >
                        Skip
                      </button>
                      <button
                        onClick={handleFeedbackSubmit}
                        disabled={feedbackSubmitting}
                        className="text-[11px] px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                      >
                        {feedbackSubmitting ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>
                )}

                {feedbackStage === "done" && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    Thanks for the feedback — it helps Chip improve.
                  </p>
                )}
              </div>
            )}

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-border/40 shrink-0">
              {voiceHint && (
                <p className="text-[10px] text-muted-foreground mb-1.5 px-1">{voiceHint}</p>
              )}
              <div className="flex gap-2 items-end">
                {voiceEnabled && (
                  <button
                    onClick={toggleRecording}
                    disabled={isLoading || messagesRemaining === 0 || recordingState === "transcribing"}
                    aria-label={recordingState === "recording" ? "Stop recording" : "Start voice input"}
                    className={cn(
                      "shrink-0 h-8 w-8 flex items-center justify-center rounded-xl border transition-colors disabled:opacity-40",
                      recordingState === "recording"
                        ? "border-red-500/60 bg-red-500/10 text-red-500 animate-pulse"
                        : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {recordingState === "transcribing" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : recordingState === "recording" ? (
                      <Square className="w-3 h-3 fill-current" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(inputValue);
                    }
                  }}
                  placeholder={
                    messagesRemaining === 0
                      ? "Session limit reached"
                      : recordingState === "recording"
                      ? "Listening… tap ■ to stop"
                      : recordingState === "transcribing"
                      ? "Transcribing…"
                      : "Ask Chip…"
                  }
                  disabled={isLoading || messagesRemaining === 0}
                  rows={1}
                  className="flex-1 min-h-8 max-h-24 resize-none text-xs py-2 rounded-xl border-border/60 bg-background/50"
                />
                <Button
                  onClick={() => sendMessage(inputValue)}
                  disabled={!inputValue.trim() || isLoading || messagesRemaining === 0}
                  size="sm"
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
