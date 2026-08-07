"use client";

import dynamic from "next/dynamic";
import type { DomainId } from "@/lib/domains";

// Client boundary for the router, mirroring ChatWidgetLoader. `ssr: false` keeps
// it off the prerendered blog payloads — it reads localStorage on mount, and
// none of it is content worth serving in the initial HTML.
const ChipDomainRouter = dynamic(
  () => import("@/components/public/ChipDomainRouter").then((m) => m.ChipDomainRouter),
  { ssr: false }
);

export function ChipDomainRouterLoader({ enabledIds }: { enabledIds: DomainId[] }) {
  return <ChipDomainRouter enabledIds={enabledIds} />;
}
