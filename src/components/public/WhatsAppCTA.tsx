"use client";

import { MessageCircle } from "lucide-react";
import { WHATSAPP_FALLBACK } from "@/lib/constants";

interface WhatsAppCTAProps {
  whatsappUrl?: string;
  variant?: "section" | "floating";
}

export function WhatsAppCTA({ whatsappUrl, variant = "section" }: WhatsAppCTAProps) {
  const url = whatsappUrl || WHATSAPP_FALLBACK;

  if (variant === "floating") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#25D366] text-white text-xs font-medium shadow-lg hover:bg-[#1ebe5c] transition-colors"
        aria-label="Join WhatsApp group for laptop help"
      >
        <MessageCircle className="w-4 h-4" />
        Ask on WhatsApp
      </a>
    );
  }

  return (
    <section className="px-4 py-10 max-w-3xl mx-auto w-full">
      <div className="glass-card rounded-2xl border p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center mx-auto">
          <MessageCircle className="w-6 h-6 text-[#25D366]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Still unsure? Ask your doubt
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Join the laptop guidance group on WhatsApp. Get advice from students and advisors who
            have been through the same buying decisions.
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg h-8 px-2.5 text-sm font-medium bg-[#25D366] text-white hover:bg-[#1ebe5c] transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Join the laptop help group
        </a>
      </div>
    </section>
  );
}
