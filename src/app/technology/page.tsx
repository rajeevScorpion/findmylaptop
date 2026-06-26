import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { DomainLanding } from "@/components/public/DomainLanding";
import { getDomainFlags } from "@/lib/flags";
import { DOMAINS } from "@/lib/domains";

export const metadata: Metadata = {
  title: DOMAINS.technology.metaTitle,
  description: DOMAINS.technology.metaDescription,
  alternates: { canonical: "/technology" },
};

export default async function TechnologyPage() {
  "use cache";
  cacheTag("flags");
  cacheLife("minutes");
  const flags = await getDomainFlags();
  if (!flags.domain_tech_enabled) {
    notFound();
  }
  return <DomainLanding domain={DOMAINS.technology} />;
}
