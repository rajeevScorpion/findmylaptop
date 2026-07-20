import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import {
  laptopMutationSchema,
  MAX_CATALOG_WRITE_REQUEST_BYTES,
} from "@/lib/admin/catalog-write-schema";
import {
  CatalogWriteError,
  writeLaptopMutation,
} from "@/lib/admin/catalog-write";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json." },
        { status: 415, headers: PRIVATE_NO_STORE }
      );
    }
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_CATALOG_WRITE_REQUEST_BYTES) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413, headers: PRIVATE_NO_STORE }
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
    const parsed = laptopMutationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid laptop mutation.", details: parsed.error.flatten() },
        { status: 400, headers: PRIVATE_NO_STORE }
      );
    }

    const result = await writeLaptopMutation(parsed.data, admin.email);
    revalidateTag("laptops", { expire: 0 });
    revalidatePath("/");
    revalidatePath("/admin/laptops");
    revalidatePath(`/laptop/${result.slug}`);

    return NextResponse.json(
      { laptop: result },
      {
        status:
          parsed.data.action === "save" && parsed.data.laptopId === null ? 201 : 200,
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
    console.error("[admin-laptops] mutation failed");
    return NextResponse.json(
      { error: "Could not update the laptop catalog." },
      { status: 500, headers: PRIVATE_NO_STORE }
    );
  }
}
