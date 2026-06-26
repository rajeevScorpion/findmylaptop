import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { DomainLanding } from "@/components/public/DomainLanding";
import { DOMAINS } from "@/lib/domains";

export const metadata: Metadata = {
  title: DOMAINS.design.metaTitle,
  description: DOMAINS.design.metaDescription,
  alternates: { canonical: "/design" },
};

export default async function DesignPage() {
  "use cache";
  cacheLife("minutes");
  return <DomainLanding domain={DOMAINS.design} />;
}
