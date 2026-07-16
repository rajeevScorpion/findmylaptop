import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import {
  adminSettingsWriteSchema,
  AdminSettingsWriteError,
  MAX_ADMIN_SETTINGS_REQUEST_BYTES,
  writeAdminSettings,
} from "@/lib/admin/settings-write";

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

    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_ADMIN_SETTINGS_REQUEST_BYTES) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413, headers: PRIVATE_NO_STORE }
      );
    }

    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_ADMIN_SETTINGS_REQUEST_BYTES) {
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

    const parsed = adminSettingsWriteSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid settings update.", details: parsed.error.flatten() },
        { status: 400, headers: PRIVATE_NO_STORE }
      );
    }

    await writeAdminSettings(parsed.data);
    revalidateTag(parsed.data.section === "general" ? "settings" : "flags", {
      expire: 0,
    });
    revalidatePath("/");
    revalidatePath("/admin/settings");
    if (parsed.data.section === "blog") revalidatePath("/blog");

    return NextResponse.json(
      { saved: true, section: parsed.data.section },
      { headers: PRIVATE_NO_STORE }
    );
  } catch (error) {
    const authResponse = adminAuthorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (!(error instanceof AdminSettingsWriteError)) {
      console.error("[admin-settings] write failed");
    }
    return NextResponse.json(
      { error: "Could not save settings." },
      { status: 500, headers: PRIVATE_NO_STORE }
    );
  }
}
