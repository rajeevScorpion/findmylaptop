"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const DIGITS = 6;

function FlipDigit({ digit }: { digit: string }) {
  return (
    <div className="relative h-11 w-8 overflow-hidden rounded-md bg-[oklch(0.5_0.14_55)] text-[oklch(0.98_0.02_70)] shadow-inner shadow-black/20 ring-1 ring-[oklch(0.42_0.12_55)]">
      {/* center seam, like a split-flap display */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px -translate-y-1/2 bg-[oklch(0.38_0.11_55)]" />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={digit}
          initial={{ y: "-110%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "110%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-semibold tabular-nums"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function VisitCounter() {
  const [count, setCount] = useState<number | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Guard against React's double-invoked effect in dev / StrictMode.
    if (started.current) return;
    started.current = true;

    // Count once per browser session; subsequent loads just read the total.
    const alreadyCounted = sessionStorage.getItem("fml_visit_counted") === "1";

    fetch("/api/visits", { method: alreadyCounted ? "GET" : "POST" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { count: number }) => {
        if (!alreadyCounted) sessionStorage.setItem("fml_visit_counted", "1");
        setCount(data.count);
      })
      .catch(() => {
        /* counter is non-critical — stay hidden on failure */
      });
  }, []);

  if (count === null) return null;

  const padded = String(count).padStart(DIGITS, "0").slice(-DIGITS);

  return (
    <section className="px-4 pb-10 max-w-3xl mx-auto w-full">
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1.5" aria-hidden="true">
          {padded.split("").map((d, i) => (
            <FlipDigit key={i} digit={d} />
          ))}
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Visits & counting
        </p>
        <span className="sr-only">{count.toLocaleString()} visits and counting</span>
      </div>
    </section>
  );
}
