import { describe, expect, it, vi } from "vitest";

import { recordSourceAdapterHealth } from "./settings";

function healthClient(returnedSource: Record<string, unknown>) {
  const sourceQuery = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: returnedSource, error: null }),
  };
  sourceQuery.update.mockReturnValue(sourceQuery);
  sourceQuery.eq.mockReturnValue(sourceQuery);
  sourceQuery.select.mockReturnValue(sourceQuery);
  const auditQuery = {
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  const client = {
    from: vi.fn((table: string) =>
      table === "source_adapters" ? sourceQuery : auditQuery
    ),
  };
  return { client, sourceQuery, auditQuery };
}

describe("recordSourceAdapterHealth", () => {
  it("persists a successful credential probe and clears old errors", async () => {
    const checkedAt = "2026-07-21T10:00:00.000Z";
    const { client, sourceQuery, auditQuery } = healthClient({
      source_key: "amazon",
      credential_status: "valid",
    });

    await recordSourceAdapterHealth(
      "amazon",
      {
        credentialStatus: "valid",
        checkedAt,
        message: "Amazon accepted the configured credentials.",
        runtimeEnabled: true,
      },
      "admin@example.com",
      client as never
    );

    expect(sourceQuery.update).toHaveBeenCalledWith({
      credential_status: "valid",
      last_health_check_at: checkedAt,
      last_success_at: checkedAt,
      last_error_at: null,
      last_error_message: null,
    });
    expect(auditQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "source_adapter.health_checked",
        actor_identifier: "admin@example.com",
        metadata_json: { credentialStatus: "valid" },
      })
    );
  });

  it("fails closed and disables a source when credentials are invalid", async () => {
    const checkedAt = "2026-07-21T10:00:00.000Z";
    const { client, sourceQuery } = healthClient({
      source_key: "amazon",
      credential_status: "invalid",
      enabled: false,
    });

    await recordSourceAdapterHealth(
      "amazon",
      {
        credentialStatus: "invalid",
        checkedAt,
        message: "Amazon rejected the configured credentials.",
        runtimeEnabled: true,
      },
      "admin@example.com",
      client as never
    );

    expect(sourceQuery.update).toHaveBeenCalledWith({
      credential_status: "invalid",
      last_health_check_at: checkedAt,
      last_error_at: checkedAt,
      last_error_message: "Amazon rejected the configured credentials.",
      enabled: false,
    });
  });

  it("keeps the database source off when its server runtime flag is disabled", async () => {
    const checkedAt = "2026-07-21T10:00:00.000Z";
    const { client, sourceQuery } = healthClient({
      source_key: "amazon",
      credential_status: "unchecked",
      enabled: false,
    });

    await recordSourceAdapterHealth(
      "amazon",
      {
        credentialStatus: "unchecked",
        checkedAt,
        message: "Disabled by server configuration.",
        runtimeEnabled: false,
      },
      "admin@example.com",
      client as never
    );

    expect(sourceQuery.update).toHaveBeenCalledWith({
      credential_status: "unchecked",
      last_health_check_at: checkedAt,
      enabled: false,
    });
  });
});
