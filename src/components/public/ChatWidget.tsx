"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LaptopMiniCard } from "./LaptopMiniCard";
import { cn } from "@/lib/utils";
import type { Laptop, ChatMessage, ChatApiResponse } from "@/lib/types";

const STORAGE_MESSAGES = "chip_messages";
const STORAGE_SESSION_ID = "chip_session_id";

const INITIAL_MESSAGE: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content:
    "Hi! I'm Chip 👋 Your personal laptop advisor for design school.\nTell me what you're studying and I'll help you find the best laptop for it.",
  recommendedSlugs: [],
  suggestions: [
    "Fashion & Lifestyle Design",
    "Game Design or Animation",
    "UI/UX / Product Design",
    "Motion / Video",
    "Not sure yet",
  ],
  timestamp: 0,
};

interface ChatWidgetProps {
  laptops: Laptop[];
}

export function ChatWidget({ laptops }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messagesRemaining, setMessagesRemaining] = useState(30);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem(STORAGE_MESSAGES);
      const savedSessionId = sessionStorage.getItem(STORAGE_SESSION_ID);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          // Mark as previously opened if real conversation exists
          if (parsed.length > 1) setHasBeenOpened(true);
        }
      }
      if (savedSessionId) {
        setSessionId(savedSessionId);
      }
    } catch {
      // sessionStorage unavailable — start fresh
    }
  }, []);

  // Persist messages to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Persist sessionId to sessionStorage
  useEffect(() => {
    if (sessionId) {
      try {
        sessionStorage.setItem(STORAGE_SESSION_ID, sessionId);
      } catch {}
    }
  }, [sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  // Focus textarea when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
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

    // Build conversation history — exclude the static greeting (it was never sent to the API)
    const historyToSend = updatedMessages
      .filter((m) => m.id !== "greeting")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyToSend,
          sessionId: sessionId ?? undefined,
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data: ChatApiResponse = await res.json();

      if (!sessionId) setSessionId(data.sessionId);
      setMessagesRemaining(data.messagesRemaining);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        recommendedSlugs: data.recommendedSlugs,
        suggestions: data.suggestions,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
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

  function handleOpen() {
    setIsOpen(true);
    setHasBeenOpened(true);
  }

  return (
    <>
      {/* ── Floating trigger button ──────────────────────────────── */}
      <div className="fixed bottom-[108px] right-4 z-40 w-12 h-12">
        {!hasBeenOpened && (
          <span className="absolute inset-0 rounded-full animate-ping bg-violet-400/40 pointer-events-none" />
        )}
        <button
          onClick={handleOpen}
          aria-label="Open Chip laptop advisor"
          className="group h-12 w-12 hover:w-36 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 flex items-center transition-[width] duration-300 ease-in-out"
        >
          <span className="flex-none flex items-center justify-center w-12 h-12">
            <Bot className="w-[18px] h-[18px]" />
          </span>
          <span className="text-xs font-semibold whitespace-nowrap pr-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100">
            Ask Chip
          </span>
        </button>
      </div>

      {/* ── Chat window ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-[170px] right-4 z-40 w-80 md:w-96 h-[520px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-gradient-to-r from-violet-500/10 to-indigo-600/10 shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">Chip</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Expert laptop advisor
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
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
                  {/* Bubble */}
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

                  {/* Laptop mini-cards */}
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

                  {/* Quick-reply suggestions */}
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

              {/* Loading dots */}
              {isLoading && (
                <div className="flex gap-1 items-center px-3 py-2 rounded-2xl rounded-bl-sm bg-muted w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Limit warning */}
            {messagesRemaining <= 5 && messagesRemaining > 0 && (
              <div className="px-3 py-1.5 bg-amber-500/10 border-t border-amber-500/20 shrink-0">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 text-center">
                  {messagesRemaining} message{messagesRemaining !== 1 ? "s" : ""} remaining this
                  session
                </p>
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
                  placeholder={
                    messagesRemaining === 0 ? "Session limit reached" : "Ask Chip…"
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
