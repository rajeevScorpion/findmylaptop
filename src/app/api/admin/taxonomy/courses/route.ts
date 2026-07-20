import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import {
  courseMutationSchema,
  MAX_CATALOG_WRITE_REQUEST_BYTES,
} from "@/lib/admin/catalog-write-schema";
import {
  CatalogWriteError,
  writeCourseMutation,
} from "@/lib/admin/catalog-write";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json." },
        { status: 415, headers: PRIVATE_NO_STORE }
      );
    }

    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_CATALOG_WRITE_REQUEST_BYTES) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413, headers: PRIVATE_NO_STORE }
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400, headers: PRIVATE_NO_STORE }
      );
    }
    const parsed = courseMutationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid taxonomy mutation.", details: parsed.error.flatten() },
        { status: 400, headers: PRIVATE_NO_STORE }
      );
    }

    const result = await writeCourseMutation(parsed.data);
    revalidateTag("taxonomy", { expire: 0 });
    revalidatePath("/admin/taxonomy");

    return NextResponse.json(
      { course: result },
      {
        status: parsed.data.action === "add" ? 201 : 200,
        headers: PRIVATE_NO_STORE,
      }
    );
  } catch (error) {
    const authResponse = adminAuthorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof CatalogWriteError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: PRIVATE_NO_STORE }
      );
    }
    console.error("[admin-taxonomy] mutation failed");
    return NextResponse.json(
      { error: "Could not update the taxonomy." },
      { status: 500, headers: PRIVATE_NO_STORE }
    );
  }
}
