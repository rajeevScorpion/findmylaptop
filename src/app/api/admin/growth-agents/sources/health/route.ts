import { connection } from "next/server";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import {
  getAgentErrorHttpStatus,
  isAgentError,
} from "@/lib/growth-agents/errors";
import { getEffectiveSourceHealth } from "@/lib/sources/health";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: PRIVATE_HEADERS });
}

function routeError(error: unknown): Response {
  const authorizationResponse = adminAuthorizationErrorResponse(error);
  if (authorizationResponse) return authorizationResponse;
  if (isAgentError(error)) {
    return json(
      { error: error.message, code: error.code },
      getAgentErrorHttpStatus(error)
    );
  }
  console.error("Source health route failed");
  return json({ error: "Source health request failed." }, 500);
}

export async function GET(_request: Request): Promise<Response> {
  await connection();
  try {
    await requireAdmin();
    // Reading health is side-effect free. Remote probes that persist status use
    // POST below so browser retries/caches cannot mutate source configuration.
    const sources = await getEffectiveSourceHealth();
    return json({ sources, probed: false });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(): Promise<Response> {
  try {
    const admin = await requireAdmin();
    const sources = await getEffectiveSourceHealth({
      probe: true,
      actorEmail: admin.email,
    });
    return json({ sources, probed: true });
  } catch (error) {
    return routeError(error);
  }
}
