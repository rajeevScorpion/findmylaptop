import type { Metadata } from "next";
import { DomainLanding } from "@/components/public/DomainLanding";
import { DOMAINS } from "@/lib/domains";

export const revalidate = 300;

export const metadata: Metadata = {
  title: DOMAINS.design.metaTitle,
  description: DOMAINS.design.metaDescription,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  return <DomainLanding domain={DOMAINS.design} />;
}
