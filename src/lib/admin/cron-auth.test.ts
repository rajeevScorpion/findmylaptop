import { afterEach, describe, expect, it, vi } from "vitest";

import {
  constantTimeSecretMatches,
  readBearerToken,
  verifyCronRequest,
  verifyCronSecret,
} from "./cron-auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cron secret helpers", () => {
  it("matches only equal, non-empty secrets", () => {
    expect(constantTimeSecretMatches("secret", "secret")).toBe(true);
    expect(constantTimeSecretMatches("secret", "different")).toBe(false);
    expect(constantTimeSecretMatches("", "")).toBe(false);
    expect(constantTimeSecretMatches(null, "secret")).toBe(false);
    expect(constantTimeSecretMatches("secret", undefined)).toBe(false);
  });

  it("parses one case-insensitive Bearer token", () => {
    expect(readBearerToken("Bearer cron-secret")).toBe("cron-secret");
    expect(readBearerToken("  bearer\tcron-secret  ")).toBe("cron-secret");
    expect(readBearerToken("Basic cron-secret")).toBeNull();
    expect(readBearerToken("Bearer two tokens")).toBeNull();
    expect(readBearerToken(null)).toBeNull();
  });

  it("supports the agent secret and legacy cron secret environment variables", () => {
    vi.stubEnv("AGENT_CRON_SECRET", "agent-secret");
    vi.stubEnv("CRON_SECRET", "legacy-secret");

    expect(verifyCronSecret("agent-secret")).toBe(true);
    expect(verifyCronSecret("legacy-secret")).toBe(true);
    expect(verifyCronSecret("wrong-secret")).toBe(false);
  });

  it("lets callers supply an explicit expected secret", () => {
    vi.stubEnv("AGENT_CRON_SECRET", "environment-secret");

    expect(verifyCronSecret("route-secret", "route-secret")).toBe(true);
    expect(verifyCronSecret("environment-secret", "route-secret")).toBe(false);
    expect(verifyCronSecret("", null)).toBe(false);
  });

  it("verifies a request from its Authorization header", () => {
    expect(
      verifyCronRequest(
        { headers: new Headers({ authorization: "Bearer route-secret" }) },
        "route-secret"
      )
    ).toBe(true);
    expect(
      verifyCronRequest(
        { headers: new Headers({ authorization: "Basic route-secret" }) },
        "route-secret"
      )
    ).toBe(false);
  });
});
