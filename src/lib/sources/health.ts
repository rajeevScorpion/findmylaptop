import "server-only";

import { listSourceAdapters as listConfiguredSources } from "@/lib/growth-agents/settings";
import type { GrowthAgentDatabaseClient } from "@/lib/growth-agents/types";
import { listSourceAdapters as listRuntimeSources } from "./registry";
import type { SourceHealth } from "./types";

export interface EffectiveSourceHealth extends SourceHealth {
  runtimeEnabled: boolean;
  databaseEnabled: boolean;
  credentialStatus: string;
  freshnessTtlMinutes: number | null;
  publicDisplayAllowed: boolean;
  requiresAdminApproval: boolean;
}

export async function getEffectiveSourceHealth(options: {
  probe?: boolean;
  client?: GrowthAgentDatabaseClient;
} = {}): Promise<EffectiveSourceHealth[]> {
  const configured = await listConfiguredSources(options.client);
  const configuredByKey = new Map(
    configured.map((source) => [source.source_key, source])
  );
  const runtime = await Promise.all(
    listRuntimeSources().map((adapter) =>
      adapter.getHealth({
        // A disabled database source must not produce an external request.
        probe:
          options.probe === true &&
          configuredByKey.get(adapter.key)?.enabled === true,
      })
    )
  );
  return runtime.map((health) => {
    const database = configuredByKey.get(health.sourceKey);
    const databaseEnabled = database?.enabled ?? false;
    return {
      ...health,
      runtimeEnabled: health.enabled,
      databaseEnabled,
      enabled: health.enabled && databaseEnabled,
      status:
        !databaseEnabled || !health.enabled ? "disabled" : health.status,
      credentialStatus: database?.credential_status ?? "not_configured",
      freshnessTtlMinutes: database?.freshness_ttl_minutes ?? null,
      publicDisplayAllowed: database?.public_display_allowed ?? false,
      requiresAdminApproval: database?.requires_admin_approval ?? true,
    };
  });
}
