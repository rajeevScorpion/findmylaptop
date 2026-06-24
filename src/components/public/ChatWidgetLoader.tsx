"use client";

import dynamic from "next/dynamic";
import type { Laptop } from "@/lib/types";
import type { DomainId } from "@/lib/domains";

const ChatWidget = dynamic(
  () => import("@/components/public/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false }
);

export function ChatWidgetLoader({
  laptops,
  voiceEnabled = true,
  domain = "design",
}: {
  laptops: Laptop[];
  voiceEnabled?: boolean;
  domain?: DomainId;
}) {
  return <ChatWidget laptops={laptops} voiceEnabled={voiceEnabled} domain={domain} />;
}
