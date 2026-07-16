import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import {
  getAgentErrorHttpStatus,
  isAgentError,
} from "@/lib/growth-agents/errors";
import {
  ingestCandidate,
  listCandidates,
} from "@/lib/products/candidates";
import {
  candidateListQuerySchema,
  ingestCandidateSchema,
} from "@/lib/sources/types";

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
      {
        error: error.message,
        code: error.code,
        retryable: error.retryable,
        details: error.details,
      },
      getAgentErrorHttpStatus(error)
    );
  }
  console.error("Product candidates route failed", error);
  return json({ error: "Product candidate request failed." }, 500);
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const parsed = candidateListQuerySchema.safeParse({
      status: url.searchParams.get("status") || undefined,
      source: url.searchParams.get("source") || undefined,
      compliance: url.searchParams.get("compliance") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    });
    if (!parsed.success) {
      return json(
        { error: "Invalid candidate filters.", details: parsed.error.flatten() },
        400
      );
    }
    return json({ candidates: await listCandidates(parsed.data) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const admin = await requireAdmin();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const parsed = ingestCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "Invalid candidate import.", details: parsed.error.flatten() },
        400
      );
    }
    const result = await ingestCandidate(parsed.data, { actorEmail: admin.email });
    return json(result, result.created ? 201 : 200);
  } catch (error) {
    return routeError(error);
  }
}
