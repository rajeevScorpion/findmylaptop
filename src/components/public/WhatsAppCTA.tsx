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
        aria-label="Ask on WhatsApp"
        className="group fixed bottom-[50px] right-4 z-30 flex items-center overflow-hidden rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 h-12 w-12 hover:w-[200px] transition-[width] duration-300 ease-in-out"
      >
        <span className="text-xs font-semibold whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[148px] transition-[max-width] duration-300 pl-0 group-hover:pl-4">
          Ask on WhatsApp
        </span>
        <span className="flex-none flex items-center justify-center w-12 h-12 ml-auto">
          <MessageCircle className="w-[18px] h-[18px]" />
        </span>
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
