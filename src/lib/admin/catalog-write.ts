import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlug } from "@/lib/recommendationEngine";
import type { CourseMutationInput, LaptopMutationInput } from "./catalog-write-schema";

type AdminDatabaseClient = ReturnType<typeof createAdminClient>;

export type CatalogWriteErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE"
  | "INVALID_REFERENCE"
  | "WRITE_FAILED";

export class CatalogWriteError extends Error {
  constructor(
    readonly code: CatalogWriteErrorCode,
    readonly status: 400 | 404 | 409 | 500,
    message: string
  ) {
    super(message);
    this.name = "CatalogWriteError";
  }
}

function mapDatabaseError(
  error: { code?: string; message?: string },
  entity: "laptop" | "course"
): CatalogWriteError {
  if (error.code === "23505" || error.message?.toLowerCase().includes("duplicate")) {
    return new CatalogWriteError(
      "DUPLICATE",
      409,
      entity === "laptop"
        ? "A laptop with that slug already exists."
        : "That specialisation already exists in this domain."
    );
  }
  if (error.code === "23503") {
    return new CatalogWriteError(
      "INVALID_REFERENCE",
      400,
      "A referenced catalog record is no longer available."
    );
  }
  return new CatalogWriteError(
    "WRITE_FAILED",
    500,
    entity === "laptop" ? "Could not save the laptop." : "Could not save the taxonomy."
  );
}

function formatPriceLabel(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

export interface LaptopMutationResult {
  action: LaptopMutationInput["action"];
  id: string;
  slug: string;
  priceLabel?: string;
}

async function requireLaptopResult(
  promise: PromiseLike<{
    data: { id: string; slug: string } | null;
    error: { code?: string; message?: string } | null;
  }>,
  action: LaptopMutationInput["action"]
): Promise<LaptopMutationResult> {
  const { data, error } = await promise;
  if (error) throw mapDatabaseError(error, "laptop");
  if (!data) throw new CatalogWriteError("NOT_FOUND", 404, "Laptop not found.");
  return { action, id: data.id, slug: data.slug };
}

/** Actor identity comes from requireAdmin() and is never accepted in input. */
export async function writeLaptopMutation(
  input: LaptopMutationInput,
  actorEmail: string,
  client: AdminDatabaseClient = createAdminClient()
): Promise<LaptopMutationResult> {
  if (input.action === "save") {
    if (input.laptopId) {
      return requireLaptopResult(
        client
          .from("laptops")
          .update(input.values)
          .eq("id", input.laptopId)
          .select("id, slug")
          .maybeSingle(),
        input.action
      );
    }

    const id = crypto.randomUUID();
    const slug = generateSlug(input.values.name, id);
    const { data, error } = await client
      .from("laptops")
      .insert({
        ...input.values,
        id,
        slug,
        created_by: actorEmail,
      })
      .select("id, slug")
      .single();
    if (error) throw mapDatabaseError(error, "laptop");
    return { action: input.action, id: data.id, slug: data.slug };
  }

  if (input.action === "delete") {
    return requireLaptopResult(
      client
        .from("laptops")
        .delete()
        .eq("id", input.laptopId)
        .select("id, slug")
        .maybeSingle(),
      input.action
    );
  }

  const fields: Record<string, unknown> =
    input.action === "set_published"
      ? { is_published: input.value }
      : input.action === "set_featured"
        ? { feature_on_home: input.value }
        : {
            price_approx: input.value,
            price_label: formatPriceLabel(input.value),
          };

  const result = await requireLaptopResult(
    client
      .from("laptops")
      .update(fields)
      .eq("id", input.laptopId)
      .select("id, slug")
      .maybeSingle(),
    input.action
  );
  if (input.action === "set_price") result.priceLabel = fields.price_label as string;
  return result;
}

export interface CourseMutationResult {
  action: CourseMutationInput["action"];
  id: string;
}

async function requireCourseResult(
  promise: PromiseLike<{
    data: { id: string } | null;
    error: { code?: string; message?: string } | null;
  }>,
  action: CourseMutationInput["action"]
): Promise<CourseMutationResult> {
  const { data, error } = await promise;
  if (error) throw mapDatabaseError(error, "course");
  if (!data) throw new CatalogWriteError("NOT_FOUND", 404, "Course not found.");
  return { action, id: data.id };
}

export async function writeCourseMutation(
  input: CourseMutationInput,
  client: AdminDatabaseClient = createAdminClient()
): Promise<CourseMutationResult> {
  if (input.action === "add") {
    const { data: lastRow, error: sortError } = await client
      .from("courses")
      .select("sort_order")
      .eq("domain", input.domain)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sortError) throw mapDatabaseError(sortError, "course");

    const { data, error } = await client
      .from("courses")
      .insert({
        domain: input.domain,
        category: input.category,
        name: input.name,
        workload_level: "balanced",
        sort_order: Number(lastRow?.sort_order ?? 0) + 1,
      })
      .select("id")
      .single();
    if (error) throw mapDatabaseError(error, "course");
    return { action: input.action, id: data.id };
  }

  if (input.action === "update") {
    return requireCourseResult(
      client
        .from("courses")
        .update({
          category: input.category,
          name: input.name,
          sort_order: input.sortOrder,
        })
        .eq("id", input.courseId)
        .select("id")
        .maybeSingle(),
      input.action
    );
  }

  if (input.action === "set_active") {
    return requireCourseResult(
      client
        .from("courses")
        .update({ is_active: input.value })
        .eq("id", input.courseId)
        .select("id")
        .maybeSingle(),
      input.action
    );
  }

  return requireCourseResult(
    client
      .from("courses")
      .delete()
      .eq("id", input.courseId)
      .select("id")
      .maybeSingle(),
    input.action
  );
}
