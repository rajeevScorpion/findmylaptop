"use client";

import dynamic from "next/dynamic";
import type { Laptop } from "@/lib/types";

const ChatWidget = dynamic(
  () => import("@/components/public/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false }
);

export function ChatWidgetLoader({
  laptops,
  voiceEnabled = true,
}: {
  laptops: Laptop[];
  voiceEnabled?: boolean;
}) {
  return <ChatWidget laptops={laptops} voiceEnabled={voiceEnabled} />;
}
