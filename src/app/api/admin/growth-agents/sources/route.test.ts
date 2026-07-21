import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import {
  listSourceAdapters,
  updateSourceAdapter,
} from "@/lib/growth-agents/settings";
import { probeSourceAdapterHealth } from "@/lib/sources/health";
import { PATCH } from "./route";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/admin/authorization", () => ({
  adminAuthorizationErrorResponse: vi.fn().mockReturnValue(null),
  requireAdmin: vi.fn(),
}));
vi.mock("@/lib/growth-agents/settings", () => ({
  listSourceAdapters: vi.fn(),
  updateSourceAdapter: vi.fn(),
}));
vi.mock("@/lib/sources/health", () => ({
  probeSourceAdapterHealth: vi.fn(),
}));

const source = {
  id: "source-amazon",
  source_key: "amazon",
  display_name: "Amazon India",
  mode: "api" as const,
  enabled: true,
  credential_status: "valid" as const,
};

function request(enabled: boolean) {
  return new Request(
    "https://laptopfinder.test/api/admin/growth-agents/sources",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceKey: "amazon", enabled }),
    }
  );
}

beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue({
    id: "admin-id",
    email: "admin@example.com",
  });
  vi.mocked(adminAuthorizationErrorResponse).mockReturnValue(null);
  vi.mocked(listSourceAdapters).mockResolvedValue([]);
  vi.mocked(probeSourceAdapterHealth).mockResolvedValue({
    runtimeEnabled: true,
    credentialStatus: "valid",
    message: "Amazon accepted the configured credentials.",
  } as never);
  vi.mocked(updateSourceAdapter).mockResolvedValue(source as never);
});

describe("admin source mutation route", () => {
  it("remotely validates and persists credentials before enabling an API source", async () => {
    const response = await PATCH(request(true));

    expect(probeSourceAdapterHealth).toHaveBeenCalledWith("amazon", {
      actorEmail: "admin@example.com",
    });
    expect(updateSourceAdapter).toHaveBeenCalledWith(
      "amazon",
      { enabled: true },
      "admin@example.com"
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ source });
  });

  it("does not probe when disabling a source", async () => {
    await PATCH(request(false));

    expect(probeSourceAdapterHealth).not.toHaveBeenCalled();
    expect(updateSourceAdapter).toHaveBeenCalledWith(
      "amazon",
      { enabled: false },
      "admin@example.com"
    );
  });

  it("refuses enablement after a failed credential probe", async () => {
    vi.mocked(probeSourceAdapterHealth).mockResolvedValue({
      runtimeEnabled: true,
      credentialStatus: "invalid",
      message: "Amazon rejected the configured credentials.",
    } as never);

    const response = await PATCH(request(true));

    expect(response.status).toBe(409);
    expect(updateSourceAdapter).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: "CONFIGURATION_ERROR",
      error: "Amazon rejected the configured credentials.",
    });
  });
});
