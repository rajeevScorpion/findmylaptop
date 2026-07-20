import { z } from "zod";
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
  createBlogDraftFromResearchPacket,
  listBlogAgentDrafts,
  listBloggableResearchPackets,
} from "@/lib/blog-agent/service";

export const maxDuration = 300;

const requestSchema = z
  .object({
    researchPacketId: z.uuid(),
    personaId: z.uuid().optional(),
  })
  .strict();

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
      { error: error.message, code: error.code, retryable: error.retryable },
      getAgentErrorHttpStatus(error)
    );
  }
  console.error("Blogging Agent draft route failed");
  return json({ error: "The Blogging Agent request failed." }, 500);
}

export async function GET(): Promise<Response> {
  await connection();
  try {
    await requireAdmin();
    const [artifacts, packets] = await Promise.all([
      listBlogAgentDrafts(),
      listBloggableResearchPackets(),
    ]);
    return json({ artifacts, packets });
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
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "Invalid draft request.", details: parsed.error.flatten() },
        400
      );
    }
    const outcome = await createBlogDraftFromResearchPacket({
      researchPacketId: parsed.data.researchPacketId,
      requestedBy: admin.email,
      personaId: parsed.data.personaId,
    });
    return json({ outcome });
  } catch (error) {
    return routeError(error);
  }
}
