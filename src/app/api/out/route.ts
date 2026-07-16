import { after, connection } from "next/server";
import { z } from "zod";
import { recordAffiliateClick } from "@/lib/affiliate/events";
import {
  isAffiliatePlacement,
  type AffiliatePlacement,
} from "@/lib/affiliate/public";
import { resolveAffiliateDestination } from "@/lib/affiliate/resolver";
import {
  getAgentErrorHttpStatus,
  isAgentError,
} from "@/lib/growth-agents/errors";

const ALLOWED_QUERY_KEYS = new Set(["laptop", "offer", "placement"]);
const UUID = z.uuid();
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

function errorResponse(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: NO_STORE_HEADERS }
  );
}

function parseRequest(request: Request):
  | { laptopId: string; offerId?: string; placement: AffiliatePlacement }
  | null {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => !ALLOWED_QUERY_KEYS.has(key))) return null;
  if (
    params.getAll("laptop").length !== 1 ||
    params.getAll("placement").length !== 1 ||
    params.getAll("offer").length > 1
  ) {
    return null;
  }
  const laptopId = params.get("laptop") ?? "";
  const offerId = params.get("offer") || undefined;
  const placement = params.get("placement") ?? "";
  if (!UUID.safeParse(laptopId).success) return null;
  if (offerId && !UUID.safeParse(offerId).success) return null;
  if (!isAffiliatePlacement(placement)) return null;
  return { laptopId, offerId, placement };
}

export async function GET(request: Request): Promise<Response> {
  await connection();
  const input = parseRequest(request);
  if (!input) return errorResponse("Invalid outbound product link.", 400);

  try {
    const resolved = await resolveAffiliateDestination(input);
    after(() => recordAffiliateClick(resolved, input.placement));
    return new Response(null, {
      status: 307,
      headers: {
        ...NO_STORE_HEADERS,
        Location: resolved.destinationUrl,
      },
    });
  } catch (error) {
    if (isAgentError(error)) {
      return errorResponse(
        "A safe product destination is not available right now.",
        getAgentErrorHttpStatus(error)
      );
    }
    console.error("Outbound product resolution failed");
    return errorResponse("A safe product destination is not available right now.", 500);
  }
}
