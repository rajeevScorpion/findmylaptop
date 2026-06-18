"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  url: string;
  title: string;
  className?: string;
}

/**
 * Shares the post via the Web Share API on supported devices (mobile),
 * falling back to copying the link to the clipboard on desktop.
 * Renders as a bare icon (no box).
 */
export function ShareButton({ url, title, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : url);

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch {
        // User cancelled or the payload was rejected — nothing to do.
      }
      return;
    }

    // Desktop fallback: copy the link.
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Share this guide"
      title={copied ? "Link copied" : "Share"}
      className={cn(
        "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
    >
      {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
    </button>
  );
}
