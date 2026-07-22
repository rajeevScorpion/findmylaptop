"use client";

import Link from "next/link";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { Cpu, MessageCircle, BookOpen } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: "easeOut" as const },
  }),
};

export function BlogHero() {
  const openChip = () => document.dispatchEvent(new CustomEvent("chip:open"));

  return (
    <LazyMotion features={domAnimation}>
      <section className="relative z-10 mb-8 pb-2">
        <div className="px-4 max-w-6xl mx-auto">
          <m.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card text-xs text-muted-foreground border mb-5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Laptop buying guides
          </m.div>

          <m.h1
            custom={0.15}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight"
          >
            Simple, honest <span className="gradient-text">laptop advice</span>
          </m.h1>

          <m.p
            custom={0.3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed"
          >
            Jargon-free guides to help students, parents, and professionals choose the
            right laptop in India — without the confusion or the sales pitch.
          </m.p>

          <m.div
            custom={0.45}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <Link
              href="/"
              className={cn(
                buttonVariants({ size: "lg" }),
                "gap-2 bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 w-full sm:w-auto"
              )}
            >
              <Cpu className="w-4 h-4" />
              Find My Laptop
            </Link>
            <Button
              onClick={openChip}
              variant="outline"
              size="lg"
              className="gap-2 border-border/60 hover:border-border w-full sm:w-auto"
            >
              <MessageCircle className="w-4 h-4" />
              Chat with Chip
            </Button>
          </m.div>
        </div>
      </section>
    </LazyMotion>
  );
}
