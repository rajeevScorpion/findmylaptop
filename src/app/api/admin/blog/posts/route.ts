import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  adminAuthorizationErrorResponse,
  requireAdmin,
} from "@/lib/admin/authorization";
import {
  blogPostWriteSchema,
  MAX_BLOG_WRITE_REQUEST_BYTES,
} from "@/lib/blog/admin-write-schema";
import { BlogPostWriteError, writeBlogPost } from "@/lib/blog/admin-write";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

function requestTooLarge(request: NextRequest): boolean {
  const value = request.headers.get("content-length");
  if (!value) return false;
  const length = Number(value);
  return Number.isFinite(length) && length > MAX_BLOG_WRITE_REQUEST_BYTES;
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json." },
        { status: 415, headers: PRIVATE_NO_STORE }
      );
    }
    if (requestTooLarge(request)) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413, headers: PRIVATE_NO_STORE }
      );
    }

    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BLOG_WRITE_REQUEST_BYTES) {
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

    const parsed = blogPostWriteSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid blog post.", details: parsed.error.flatten() },
        { status: 400, headers: PRIVATE_NO_STORE }
      );
    }

    const result = await writeBlogPost(parsed.data, admin.email);

    revalidateTag("blog", { expire: 0 });
    revalidatePath("/blog");
    revalidatePath(`/blog/${result.slug}`);
    if (result.previousSlug && result.previousSlug !== result.slug) {
      revalidatePath(`/blog/${result.previousSlug}`);
    }
    revalidatePath("/admin/blog");
    revalidatePath(`/admin/blog/${result.id}`);

    return NextResponse.json(
      { post: { id: result.id, slug: result.slug, status: result.status } },
      {
        status: parsed.data.postId ? 200 : 201,
        headers: PRIVATE_NO_STORE,
      }
    );
  } catch (error) {
    const authResponse = adminAuthorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof BlogPostWriteError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: PRIVATE_NO_STORE }
      );
    }
    console.error("[admin-blog-posts] write failed");
    return NextResponse.json(
      { error: "Could not save the blog post." },
      { status: 500, headers: PRIVATE_NO_STORE }
    );
  }
}
