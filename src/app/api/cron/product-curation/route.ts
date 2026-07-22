import { verifyCronRequest } from "@/lib/admin/cron-auth";
import { pollProductCuration } from "@/lib/product-curation/orchestrator";

export const maxDuration = 60;

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request): Promise<Response> {
  if (!verifyCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  try {
    const result = await pollProductCuration();
    return Response.json(result, { headers: NO_STORE_HEADERS });
  } catch {
    console.error("Product curation cron poll failed");
    return Response.json({ error: "Product curation scheduler failed." }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
