import { afterEach, describe, expect, it, vi } from "vitest";

import { amazonSourceAdapter } from "./amazon";

function configureAmazon() {
  vi.stubEnv("AMAZON_CREATORS_ENABLED", "true");
  vi.stubEnv("AMAZON_CREATORS_CLIENT_ID", "client-id");
  vi.stubEnv("AMAZON_CREATORS_CLIENT_SECRET", "client-secret");
  vi.stubEnv("AMAZON_PARTNER_TAG", "laptopfinder-21");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Amazon source credential health", () => {
  it("performs a fresh remote authentication probe and marks credentials valid", async () => {
    configureAmazon();
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ access_token: "token", expires_in: 3600 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const health = await amazonSourceAdapter.getHealth({ probe: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.amazon.co.uk/auth/o2/token",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );
    expect(health).toMatchObject({
      status: "ready",
      configured: true,
      remoteChecked: true,
      credentialStatus: "valid",
    });
    expect(health.message).not.toContain("token");
  });

  it("classifies rejected client credentials without exposing provider data", async () => {
    configureAmazon();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"account":"private"}', { status: 401 })
      )
    );

    const health = await amazonSourceAdapter.getHealth({ probe: true });

    expect(health).toMatchObject({
      status: "unavailable",
      remoteChecked: true,
      credentialStatus: "invalid",
      message: "Amazon rejected the configured Creators API client credentials.",
    });
    expect(health.message).not.toContain("private");
  });

  it("records transient provider failures as errors rather than invalid credentials", async () => {
    configureAmazon();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    );

    const health = await amazonSourceAdapter.getHealth({ probe: true });

    expect(health).toMatchObject({
      status: "unavailable",
      remoteChecked: true,
      credentialStatus: "error",
    });
  });

  it("does not make a remote request when required configuration is missing", async () => {
    vi.stubEnv("AMAZON_CREATORS_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn());

    const health = await amazonSourceAdapter.getHealth({ probe: true });

    expect(fetch).not.toHaveBeenCalled();
    expect(health).toMatchObject({
      status: "unconfigured",
      configured: false,
      remoteChecked: false,
      credentialStatus: "not_configured",
    });
  });
});
