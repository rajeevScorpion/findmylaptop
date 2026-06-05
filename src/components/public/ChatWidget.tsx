"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X, Send, Maximize2, Minimize2, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LaptopMiniCard } from "./LaptopMiniCard";
import { cn } from "@/lib/utils";
import type { Laptop, ChatMessage, ChatApiResponse } from "@/lib/types";

const STORAGE_MESSAGES = "chip_messages";
const STORAGE_SESSION_ID = "chip_session_id";
const STORAGE_RATED = "chip_rated";

const INITIAL_MESSAGE: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content:
    "Hi! I'm Chip 👋 I help designers find the right laptop — whether you're just starting out, in school, or working professionally.\n\nAre you a design aspirant, student, or working professional?",
  recommendedSlugs: [],
  suggestions: [
    "Design Aspirant / Fresher",
    "Design Student",
    "Working Design Professional",
    "Just Exploring",
  ],
  timestamp: 0,
};

interface ChatWidgetProps {
  laptops: Laptop[];
}

export function ChatWidget({ laptops }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messagesRemaining, setMessagesRemaining] = useState(30);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Feedback state
  type FeedbackStage = "prompt" | "comment" | "done";
  const [feedbackStage, setFeedbackStage] = useState<FeedbackStage | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<boolean | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const hasRecommendation = useMemo(
    () => messages.some((m) => m.role === "assistant" && (m.recommendedSlugs?.length ?? 0) > 0),
    [messages]
  );

  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem(STORAGE_MESSAGES);
      const savedSessionId = sessionStorage.getItem(STORAGE_SESSION_ID);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
      if (savedSessionId) setSessionId(savedSessionId);
      if (localStorage.getItem("chip_opened") === "1") setHasBeenOpened(true);
      if (sessionStorage.getItem(STORAGE_RATED) === "1") setFeedbackStage("done");
    } catch {}

    const handleOpenEvent = () => {
      setIsOpen(true);
      setHasBeenOpened(true);
      try { localStorage.setItem("chip_opened", "1"); } catch {}
    };
    document.addEventListener("chip:open", handleOpenEvent);
    return () => document.removeEventListener("chip:open", handleOpenEvent);
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    if (sessionId) {
      try { sessionStorage.setItem(STORAGE_SESSION_ID, sessionId); } catch {}
    }
  }, [sessionId]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isOpen]);

  // Show feedback prompt once the first recommendation appears (and not already rated)
  useEffect(() => {
    if (hasRecommendation && feedbackStage === null) {
      try {
        if (sessionStorage.getItem(STORAGE_RATED) !== "1") {
          setFeedbackStage("prompt");
        }
      } catch {
        setFeedbackStage("prompt");
      }
    }
  }, [hasRecommendation, feedbackStage]);

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 100);
  }, [isOpen]);

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
        body: JSON.stringify({ messages: historyToSend, sessionId: sessionId ?? undefined }),
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

  async function submitFeedback(rating: boolean, comment?: string) {
    if (!sessionId || feedbackSubmitting) return;
    setFeedbackSubmitting(true);

    const allSlugs = messages.flatMap((m) => m.recommendedSlugs ?? []);
    const uniqueSlugs = [...new Set(allSlugs)];
    const transcript = messages
      .filter((m) => m.id !== "greeting")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          rating,
          comment: comment?.trim() || undefined,
          transcript,
          recommended_slugs: uniqueSlugs,
          message_count: transcript.length,
        }),
      });
      try { sessionStorage.setItem(STORAGE_RATED, "1"); } catch {}
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

  function handleClose() {
    setIsOpen(false);
    setIsMaximized(false);
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
            className={cn(
              "z-[40] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden",
              isMaximized
                ? "fixed inset-3"
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
                <p className="text-[11px] text-muted-foreground leading-tight">Expert laptop advisor</p>
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
              <div className="flex gap-2 items-end">
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
                  placeholder={messagesRemaining === 0 ? "Session limit reached" : "Ask Chip…"}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
