import "server-only";

import { AgentError } from "@/lib/growth-agents/errors";
import {
  listSourceAdapters as listConfiguredSources,
  recordSourceAdapterHealth,
} from "@/lib/growth-agents/settings";
import type { GrowthAgentDatabaseClient } from "@/lib/growth-agents/types";
import {
  getSourceAdapter,
  listSourceAdapters as listRuntimeSources,
} from "./registry";
import type { SourceHealth } from "./types";

export interface EffectiveSourceHealth extends SourceHealth {
  runtimeEnabled: boolean;
  databaseEnabled: boolean;
  freshnessTtlMinutes: number | null;
  publicDisplayAllowed: boolean;
  requiresAdminApproval: boolean;
}

function effectiveHealth(
  health: SourceHealth,
  database: Awaited<ReturnType<typeof listConfiguredSources>>[number] | undefined
): EffectiveSourceHealth {
  const databaseEnabled = database?.enabled ?? false;
  return {
    ...health,
    runtimeEnabled: health.enabled,
    databaseEnabled,
    enabled: health.enabled && databaseEnabled,
    status: !databaseEnabled || !health.enabled ? "disabled" : health.status,
    credentialStatus: database?.credential_status ?? health.credentialStatus,
    freshnessTtlMinutes: database?.freshness_ttl_minutes ?? null,
    publicDisplayAllowed: database?.public_display_allowed ?? false,
    requiresAdminApproval: database?.requires_admin_approval ?? true,
  };
}

export async function probeSourceAdapterHealth(
  sourceKey: string,
  options: {
    actorEmail: string;
    client?: GrowthAgentDatabaseClient;
  }
): Promise<EffectiveSourceHealth> {
  const configured = await listConfiguredSources(options.client);
  const database = configured.find((source) => source.source_key === sourceKey);
  if (!database) {
    throw new AgentError({
      code: "NOT_FOUND",
      message: "Source adapter not found.",
      details: { sourceKey },
    });
  }
  const health = await getSourceAdapter(sourceKey).getHealth({ probe: true });
  const persisted = await recordSourceAdapterHealth(
    sourceKey,
    {
      credentialStatus: health.credentialStatus,
      checkedAt: health.checkedAt,
      message: health.message,
      runtimeEnabled: health.enabled,
    },
    options.actorEmail,
    options.client
  );
  return effectiveHealth(health, persisted);
}

export async function getEffectiveSourceHealth(options: {
  probe?: boolean;
  client?: GrowthAgentDatabaseClient;
  actorEmail?: string;
} = {}): Promise<EffectiveSourceHealth[]> {
  const configured = await listConfiguredSources(options.client);
  const configuredByKey = new Map(
    configured.map((source) => [source.source_key, source])
  );
  const runtime = await Promise.all(
    listRuntimeSources().map((adapter) =>
      adapter.getHealth({
        // An explicit admin probe is the activation path for a disabled API
        // source, so it must be allowed to reach the provider before the
        // database enable flag can become true.
        probe: options.probe === true,
      })
    )
  );
  if (options.probe) {
    if (!options.actorEmail) {
      throw new AgentError({
        code: "VALIDATION_ERROR",
        message: "An administrator identity is required to persist source health.",
      });
    }
    const persisted = await Promise.all(
      runtime.map((health) =>
        recordSourceAdapterHealth(
          health.sourceKey,
          {
            credentialStatus: health.credentialStatus,
            checkedAt: health.checkedAt,
            message: health.message,
            runtimeEnabled: health.enabled,
          },
          options.actorEmail as string,
          options.client
        )
      )
    );
    for (const source of persisted) configuredByKey.set(source.source_key, source);
  }
  return runtime.map((health) =>
    effectiveHealth(health, configuredByKey.get(health.sourceKey))
  );
}
