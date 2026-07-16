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
  console.error("Source health route failed", error);
  return json({ error: "Source health request failed." }, 500);
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdmin();
    const probe = new URL(request.url).searchParams.get("probe") === "true";
    const sources = await getEffectiveSourceHealth({ probe });
    return json({ sources, probed: probe });
  } catch (error) {
    return routeError(error);
  }
}
