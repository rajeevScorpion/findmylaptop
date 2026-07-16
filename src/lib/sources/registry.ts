import "server-only";

import { AgentError } from "@/lib/growth-agents/errors";
import { amazonSourceAdapter } from "./amazon";
import { flipkartSourceAdapter } from "./flipkart";
import { manualSourceAdapter } from "./manual";
import type { SourceAdapter, SourceHealth } from "./types";

const adapters = new Map<string, SourceAdapter>(
  [manualSourceAdapter, amazonSourceAdapter, flipkartSourceAdapter].map((adapter) => [
    adapter.key,
    adapter,
  ])
);

export function listSourceAdapters(): SourceAdapter[] {
  return [...adapters.values()];
}

export function getSourceAdapter(sourceKey: string): SourceAdapter {
  const adapter = adapters.get(sourceKey.trim().toLowerCase());
  if (!adapter) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: `Unknown product source: ${sourceKey}.`,
      details: { supportedSources: [...adapters.keys()] },
    });
  }
  return adapter;
}

export async function getSourceHealth(options?: {
  probe?: boolean;
}): Promise<SourceHealth[]> {
  return Promise.all(
    listSourceAdapters().map((adapter) => adapter.getHealth(options))
  );
}

export function registerSourceAdapter(adapter: SourceAdapter): void {
  if (adapters.has(adapter.key)) {
    throw new AgentError({
      code: "CONFLICT",
      message: `A source adapter is already registered for ${adapter.key}.`,
    });
  }
  adapters.set(adapter.key, adapter);
}
