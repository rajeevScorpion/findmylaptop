"use client";

import { LazyMotion, domAnimation, m } from "framer-motion";
import { Cpu, ChevronDown, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: "easeOut" as const },
  }),
};

export function HeroSection() {
  const scrollToFinder = () => {
    document.getElementById("finder")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToExplainer = () => {
    document.getElementById("explainer")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <LazyMotion features={domAnimation}>
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 pt-16 pb-12 hero-gradient grid-pattern overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
          <m.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card text-xs text-muted-foreground border mb-2"
          >
            Trusted by design students &amp; professionals
          </m.div>

          <m.h1
            custom={0.15}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight"
          >
            Find the right laptop for{" "}
            <span className="gradient-text">your design journey</span>
          </m.h1>

          <m.p
            custom={0.3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
          >
            Whether you&apos;re heading into design school or deep into
            professional practice — answer a few quick questions and get matched
            to hardware built for the work you actually do.
          </m.p>

          <m.div
            custom={0.45}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
          >
            <Button
              size="lg"
              onClick={scrollToFinder}
              className="gap-2 bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 w-full sm:w-auto"
            >
              <Cpu className="w-4 h-4" />
              Find My Laptop
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={scrollToExplainer}
              className="gap-2 border-border/60 hover:border-border w-full sm:w-auto"
            >
              Understand Laptop Specs
            </Button>
          </m.div>

          <m.div
            custom={0.6}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-xs text-muted-foreground pt-4 space-y-2"
          >
            <p>No sign-in required · No data collected · Just good advice</p>
            <button
              onClick={() => document.dispatchEvent(new CustomEvent("chip:open"))}
              className="inline-flex items-center gap-1.5 text-xs text-violet-500 hover:text-violet-400 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Or chat with Chip for a personalised pick
            </button>
          </m.div>
        </div>

        {/* Scroll indicator */}
        <m.button
          onClick={scrollToFinder}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted-foreground hover:text-foreground transition-colors"
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          aria-label="Scroll to finder"
        >
          <ChevronDown className="w-5 h-5" />
        </m.button>
      </section>
    </LazyMotion>
  );
}
