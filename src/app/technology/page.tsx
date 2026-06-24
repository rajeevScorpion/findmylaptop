import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DomainLanding } from "@/components/public/DomainLanding";
import { getDomainFlags } from "@/lib/flags";
import { DOMAINS } from "@/lib/domains";

// Dynamic: gated by a DB feature flag and renders per-request (cookies), so a
// flag flip takes effect immediately rather than waiting on ISR.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: DOMAINS.technology.metaTitle,
  description: DOMAINS.technology.metaDescription,
  alternates: { canonical: "/technology" },
};

export default async function TechnologyPage() {
  const flags = await getDomainFlags();
  if (!flags.domain_tech_enabled) {
    notFound();
  }
  return <DomainLanding domain={DOMAINS.technology} />;
}
