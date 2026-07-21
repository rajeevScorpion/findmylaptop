import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listConfiguredSources: vi.fn(),
  recordSourceAdapterHealth: vi.fn(),
  getSourceAdapter: vi.fn(),
  listRuntimeSources: vi.fn(),
}));

vi.mock("@/lib/growth-agents/settings", () => ({
  listSourceAdapters: mocks.listConfiguredSources,
  recordSourceAdapterHealth: mocks.recordSourceAdapterHealth,
}));
vi.mock("./registry", () => ({
  getSourceAdapter: mocks.getSourceAdapter,
  listSourceAdapters: mocks.listRuntimeSources,
}));

import {
  getEffectiveSourceHealth,
  probeSourceAdapterHealth,
} from "./health";

const databaseSource = {
  id: "source-amazon",
  source_key: "amazon",
  display_name: "Amazon India",
  mode: "api" as const,
  enabled: false,
  credential_status: "not_configured" as const,
  freshness_ttl_minutes: 1440,
  public_display_allowed: false,
  requires_admin_approval: true,
  last_health_check_at: null,
  last_success_at: null,
  last_error_at: null,
  last_error_message: null,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

const validHealth = {
  sourceKey: "amazon",
  displayName: "Amazon India",
  mode: "api" as const,
  enabled: true,
  configured: true,
  status: "ready" as const,
  message: "Amazon accepted the configured credentials.",
  checkedAt: "2026-07-21T10:00:00.000Z",
  capabilities: {
    productId: true,
    productUrl: true,
    manualPayload: false,
    livePrice: true,
  },
  remoteChecked: true,
  credentialStatus: "valid" as const,
};

const runtimeAdapter = {
  key: "amazon",
  getHealth: vi.fn(),
};

beforeEach(() => {
  runtimeAdapter.getHealth.mockResolvedValue(validHealth);
  mocks.listConfiguredSources.mockResolvedValue([databaseSource]);
  mocks.listRuntimeSources.mockReturnValue([runtimeAdapter]);
  mocks.getSourceAdapter.mockReturnValue(runtimeAdapter);
  mocks.recordSourceAdapterHealth.mockResolvedValue({
    ...databaseSource,
    credential_status: "valid",
    last_health_check_at: validHealth.checkedAt,
    last_success_at: validHealth.checkedAt,
  });
});

describe("effective source health", () => {
  it("allows an explicit admin probe while the database source is disabled and persists it", async () => {
    const result = await getEffectiveSourceHealth({
      probe: true,
      actorEmail: "admin@example.com",
    });

    expect(runtimeAdapter.getHealth).toHaveBeenCalledWith({ probe: true });
    expect(mocks.recordSourceAdapterHealth).toHaveBeenCalledWith(
      "amazon",
      {
        credentialStatus: "valid",
        checkedAt: validHealth.checkedAt,
        message: validHealth.message,
        runtimeEnabled: true,
      },
      "admin@example.com",
      undefined
    );
    expect(result[0]).toMatchObject({
      runtimeEnabled: true,
      databaseEnabled: false,
      enabled: false,
      status: "disabled",
      credentialStatus: "valid",
      remoteChecked: true,
    });
  });

  it("keeps ordinary health reads side-effect free", async () => {
    await getEffectiveSourceHealth();

    expect(runtimeAdapter.getHealth).toHaveBeenCalledWith({ probe: false });
    expect(mocks.recordSourceAdapterHealth).not.toHaveBeenCalled();
  });

  it("probes and persists one source before an enable mutation", async () => {
    const result = await probeSourceAdapterHealth("amazon", {
      actorEmail: "admin@example.com",
    });

    expect(mocks.getSourceAdapter).toHaveBeenCalledWith("amazon");
    expect(runtimeAdapter.getHealth).toHaveBeenCalledWith({ probe: true });
    expect(result).toMatchObject({
      credentialStatus: "valid",
      databaseEnabled: false,
      runtimeEnabled: true,
    });
  });
});
