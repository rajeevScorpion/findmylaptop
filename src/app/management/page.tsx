import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { DomainLanding } from "@/components/public/DomainLanding";
import { getDomainFlags } from "@/lib/flags";
import { DOMAINS } from "@/lib/domains";

export const metadata: Metadata = {
  title: DOMAINS.management.metaTitle,
  description: DOMAINS.management.metaDescription,
  alternates: { canonical: "/management" },
};

export default async function ManagementPage() {
  "use cache";
  cacheTag("flags");
  cacheLife("minutes");
  const flags = await getDomainFlags();
  if (!flags.domain_mgmt_enabled) {
    notFound();
  }
  return <DomainLanding domain={DOMAINS.management} />;
}
