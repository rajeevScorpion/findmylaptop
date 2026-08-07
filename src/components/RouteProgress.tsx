"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { shouldTrackNavigation } from "@/lib/navigation-progress";

// A thin indeterminate bar pinned under the address bar. It exists because a
// client-side route transition changes nothing on screen until the new segment
// commits — without it, a slow page looks like a dead click.
//
// The two ends are real: it starts on a click that will genuinely navigate and
// stops when the router commits the destination. The creep between them is not
// — the router reports no byte-level progress for an RSC payload, so there is
// nothing truthful to animate against. Treat it as "still working", not "40%".
//
// Because of that, the bar has to be conservative about starting: a navigation
// served from the client cache commits in a few milliseconds, and a bar that
// flashes on those reads as noise rather than feedback.
const START_DELAY_MS = 220;
const TRICKLE_MS = 300;
const FADE_OUT_MS = 260;
// Backstop for the rare click that never navigates (a handler cancels it, or a
// redirect lands back on the same URL) so the bar can't get stuck on screen.
const SAFETY_MS = 10000;

export function RouteProgress() {
  const pathname = usePathname();
  const [bar, setBar] = useState<{ visible: boolean; value: number }>({
    visible: false,
    value: 0,
  });

  const pendingRef = useRef(false);
  const destinationRef = useRef<string | null>(null);
  const startTimer = useRef<number | null>(null);
  const trickleTimer = useRef<number | null>(null);
  const fadeTimer = useRef<number | null>(null);
  const safetyTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (startTimer.current !== null) window.clearTimeout(startTimer.current);
    if (trickleTimer.current !== null) window.clearInterval(trickleTimer.current);
    if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current);
    if (safetyTimer.current !== null) window.clearTimeout(safetyTimer.current);
    startTimer.current = trickleTimer.current = null;
    fadeTimer.current = safetyTimer.current = null;
  }, []);

  const finish = useCallback(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    clearTimers();
    // Only draw the completion sweep if the bar actually made it on screen.
    setBar((prev) => (prev.visible ? { visible: true, value: 100 } : prev));
    fadeTimer.current = window.setTimeout(
      () => setBar({ visible: false, value: 0 }),
      FADE_OUT_MS
    );
  }, [clearTimers]);

  const start = useCallback(
    (destination: string) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      destinationRef.current = destination;
      clearTimers();
      setBar({ visible: false, value: 0 });

      startTimer.current = window.setTimeout(() => {
        setBar({ visible: true, value: 12 });
        trickleTimer.current = window.setInterval(() => {
          // A navigation that only changes search params leaves the pathname
          // alone, so the effect below never fires — catch those here.
          if (destinationRef.current === window.location.href) {
            finish();
            return;
          }
          // Decelerating creep — fast at first, asymptotic towards 90%.
          setBar((prev) =>
            prev.value >= 90
              ? prev
              : { visible: true, value: prev.value + Math.max(0.8, (92 - prev.value) / 8) }
          );
        }, TRICKLE_MS);
      }, START_DELAY_MS);

      safetyTimer.current = window.setTimeout(finish, SAFETY_MS);
    },
    [clearTimers, finish]
  );

  // The router updates the pathname when the new segment commits, which is the
  // moment the user first sees the destination.
  useEffect(() => {
    finish();
  }, [pathname, finish]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute("href");
      if (
        shouldTrackNavigation({
          href,
          currentHref: window.location.href,
          target: anchor.target,
          download: anchor.hasAttribute("download"),
        })
      ) {
        start(new URL(href as string, window.location.href).href);
      }
    }

    // Deliberately no `popstate` listener. Back/forward restores from the
    // client router cache, so it commits before there is anything to wait for —
    // and the browser has already applied the URL by the time popstate fires,
    // which leaves no reliable signal for when the route actually committed. A
    // bar there is a false positive on a navigation the user perceives as
    // instant.
    //
    // Capture phase: React's own click handling calls preventDefault() on
    // <Link>, so a bubble-phase listener would only ever see cancelled events.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [start]);

  useEffect(() => clearTimers, [clearTimers]);

  if (!bar.visible) return null;

  const complete = bar.value >= 100;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
      role="progressbar"
      aria-label="Loading page"
      // No aria-valuenow: the width is a guess, not a measurement, and ARIA
      // reads a missing value as indeterminate — which is the truth here.
    >
      <div
        className="h-full bg-primary shadow-[0_0_10px_1px] shadow-primary/50 transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `${bar.value}%`, opacity: complete ? 0 : 1 }}
      />
    </div>
  );
}
