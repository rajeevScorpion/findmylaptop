import { connection } from "next/server";
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
const MAX_IMPORT_REQUEST_BYTES = 512 * 1024;

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
  console.error("Product candidates route failed");
  return json({ error: "Product candidate request failed." }, 500);
}

export async function GET(request: Request): Promise<Response> {
  await connection();
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
    if (
      !request.headers.get("content-type")?.toLowerCase().includes("application/json")
    ) {
      return json({ error: "Content-Type must be application/json." }, 415);
    }
    let body: unknown;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_IMPORT_REQUEST_BYTES) {
        return json({ error: "Candidate import is too large." }, 413);
      }
      body = JSON.parse(raw);
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
