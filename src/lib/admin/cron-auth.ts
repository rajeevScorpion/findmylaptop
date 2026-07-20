import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

function digestSecret(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Compare secrets through fixed-length digests to avoid length/timing leaks. */
export function constantTimeSecretMatches(
  candidate: string | null | undefined,
  expected: string | null | undefined
): boolean {
  const candidateValue = candidate ?? "";
  const expectedValue = expected ?? "";
  const equal = timingSafeEqual(
    digestSecret(candidateValue),
    digestSecret(expectedValue)
  );

  return candidateValue.length > 0 && expectedValue.length > 0 && equal;
}

export function readBearerToken(
  authorizationHeader: string | null | undefined
): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer[ \t]+([^\s]+)$/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}

export function verifyCronSecret(
  candidate: string | null | undefined,
  expected?: string | null
): boolean {
  const configured =
    expected !== undefined
      ? [expected]
      : [process.env.AGENT_CRON_SECRET, process.env.CRON_SECRET];
  return configured.some((secret) => constantTimeSecretMatches(candidate, secret));
}

export function verifyCronRequest(
  request: Pick<Request, "headers">,
  expected?: string | null
): boolean {
  return verifyCronSecret(
    readBearerToken(request.headers.get("authorization")),
    expected
  );
}
