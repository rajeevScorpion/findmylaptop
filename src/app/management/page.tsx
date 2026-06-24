import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DomainLanding } from "@/components/public/DomainLanding";
import { getDomainFlags } from "@/lib/flags";
import { DOMAINS } from "@/lib/domains";

// Dynamic: gated by a DB feature flag and renders per-request (cookies), so a
// flag flip takes effect immediately rather than waiting on ISR.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: DOMAINS.management.metaTitle,
  description: DOMAINS.management.metaDescription,
  alternates: { canonical: "/management" },
};

export default async function ManagementPage() {
  const flags = await getDomainFlags();
  if (!flags.domain_mgmt_enabled) {
    notFound();
  }
  return <DomainLanding domain={DOMAINS.management} />;
}
