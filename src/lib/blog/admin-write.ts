import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { readingTimeMinutes } from "@/lib/blog/slug";
import { buildToc, syncHeadingIds } from "@/lib/blog/toc";
import type { BlogContentDoc, BlogStatus } from "@/lib/blog/types";
import type { PersonaAuthorType, PersonaPublicSnapshot } from "@/lib/personas/types";
import type { BlogPostWriteInput } from "./admin-write-schema";

type AdminDatabaseClient = ReturnType<typeof createAdminClient>;

interface ExistingPostRow extends Record<string, unknown> {
  id: string;
  slug: string;
  status: BlogStatus;
  published_at?: string | null;
  author_persona_id?: string | null;
  author_persona_snapshot_json?: unknown;
}

interface PersonaSnapshotRow {
  id: string;
  slug: string;
  display_name: string;
  public_role: string;
  short_bio: string;
  author_type: PersonaAuthorType;
  version: number;
  avatar_url: string | null;
  expertise_tags: string[] | null;
  disclosure_text: string;
  status: string;
}

export type BlogPostWriteErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_SLUG"
  | "INVALID_REFERENCE"
  | "PERSONA_UNAVAILABLE"
  | "WRITE_FAILED";

export class BlogPostWriteError extends Error {
  constructor(
    readonly code: BlogPostWriteErrorCode,
    readonly status: 400 | 404 | 409 | 500,
    message: string
  ) {
    super(message);
    this.name = "BlogPostWriteError";
  }
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length <= maxLength)
  );
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function isStoredPublicSnapshot(
  value: unknown,
  expectedPersonaId: string
): value is PersonaPublicSnapshot {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.id === expectedPersonaId &&
    typeof row.slug === "string" &&
    row.slug.length <= 200 &&
    typeof row.displayName === "string" &&
    row.displayName.length <= 300 &&
    typeof row.publicRole === "string" &&
    row.publicRole.length <= 300 &&
    typeof row.shortBio === "string" &&
    row.shortBio.length <= 2_000 &&
    (row.authorType === "human" || row.authorType === "ai_persona" || row.authorType === "brand") &&
    typeof row.version === "number" &&
    Number.isInteger(row.version) &&
    row.version >= 1 &&
    (row.avatarUrl === null ||
      (typeof row.avatarUrl === "string" &&
        row.avatarUrl.length <= 2_048 &&
        isPublicHttpUrl(row.avatarUrl))) &&
    isStringArray(row.expertiseTags, 100, 200) &&
    typeof row.disclosureText === "string" &&
    row.disclosureText.length <= 2_000
  );
}

function toPublicSnapshot(persona: PersonaSnapshotRow): PersonaPublicSnapshot {
  return {
    id: persona.id,
    slug: persona.slug,
    displayName: persona.display_name,
    publicRole: persona.public_role,
    shortBio: persona.short_bio,
    authorType: persona.author_type,
    version: persona.version,
    avatarUrl:
      persona.avatar_url && isPublicHttpUrl(persona.avatar_url)
        ? persona.avatar_url
        : null,
    expertiseTags: persona.expertise_tags ?? [],
    disclosureText: persona.disclosure_text,
  };
}

async function loadPersonaSnapshot(
  client: AdminDatabaseClient,
  personaId: string,
  allowInactive: boolean
): Promise<PersonaPublicSnapshot> {
  const { data, error } = await client
    .from("blog_author_personas")
    .select(
      "id, slug, display_name, public_role, short_bio, author_type, version, avatar_url, expertise_tags, disclosure_text, status"
    )
    .eq("id", personaId)
    .maybeSingle();

  if (error) {
    throw new BlogPostWriteError(
      "PERSONA_UNAVAILABLE",
      409,
      "Persona support is not available in this deployment yet."
    );
  }
  if (
    !data ||
    data.status === "soft_deleted" ||
    (!allowInactive && data.status !== "active")
  ) {
    throw new BlogPostWriteError(
      "INVALID_REFERENCE",
      400,
      "The selected author persona is not active."
    );
  }
  return toPublicSnapshot(data as PersonaSnapshotRow);
}

async function resolvePersonaSnapshot(
  client: AdminDatabaseClient,
  input: BlogPostWriteInput,
  existing: ExistingPostRow | null
): Promise<PersonaPublicSnapshot | null> {
  const personaId = input.authorPersonaId;
  if (!personaId) return null;

  const assignmentUnchanged = existing?.author_persona_id === personaId;
  if (
    assignmentUnchanged &&
    !input.refreshPersonaSnapshot &&
    isStoredPublicSnapshot(existing.author_persona_snapshot_json, personaId)
  ) {
    // Preserve the immutable DB snapshot for an unchanged attribution. The
    // browser never supplies this value.
    return existing.author_persona_snapshot_json;
  }

  // Existing posts may deliberately retain or refresh an archived attribution,
  // but a new assignment must use an active persona. The browser's filtered
  // selector is convenience only; this is the trusted enforcement boundary.
  return loadPersonaSnapshot(client, personaId, assignmentUnchanged);
}

function mapDatabaseWriteError(error: { code?: string; message?: string }): BlogPostWriteError {
  if (error.code === "23505" || error.message?.toLowerCase().includes("duplicate")) {
    return new BlogPostWriteError(
      "DUPLICATE_SLUG",
      409,
      "That slug is already in use."
    );
  }
  if (error.code === "23503") {
    return new BlogPostWriteError(
      "INVALID_REFERENCE",
      400,
      "The selected category or persona is no longer available."
    );
  }
  return new BlogPostWriteError("WRITE_FAILED", 500, "Could not save the blog post.");
}

export interface BlogPostWriteResult {
  id: string;
  slug: string;
  status: BlogStatus;
  previousSlug: string | null;
}

/**
 * Persist a CMS post exclusively through the service-role client. `actorEmail`
 * must come from requireAdmin(); it is never part of the browser payload.
 */
export async function writeBlogPost(
  input: BlogPostWriteInput,
  actorEmail: string,
  client: AdminDatabaseClient = createAdminClient()
): Promise<BlogPostWriteResult> {
  let existing: ExistingPostRow | null = null;
  if (input.postId) {
    const { data, error } = await client
      .from("blog_posts")
      .select("*")
      .eq("id", input.postId)
      .maybeSingle();
    if (error) throw mapDatabaseWriteError(error);
    if (!data) {
      throw new BlogPostWriteError("NOT_FOUND", 404, "Blog post not found.");
    }
    existing = data as ExistingPostRow;
  }

  const content = syncHeadingIds(input.content as unknown as BlogContentDoc);
  const snapshot = await resolvePersonaSnapshot(client, input, existing);
  const row: Record<string, unknown> = {
    title: input.title,
    slug: input.slug,
    excerpt: emptyToNull(input.excerpt),
    content_json: content,
    toc_json: buildToc(content),
    reading_time_minutes: readingTimeMinutes(content),
    status: input.status,
    template_type: emptyToNull(input.templateType),
    audience: input.audience,
    primary_keyword: emptyToNull(input.primaryKeyword),
    secondary_keywords: input.secondaryKeywords,
    meta_title: emptyToNull(input.metaTitle),
    meta_description: emptyToNull(input.metaDescription),
    canonical_url: emptyToNull(input.canonicalUrl),
    og_image_url: emptyToNull(input.ogImageUrl),
    category_id: input.categoryId,
    ai_inputs: input.aiInputs,
    updated_by: actorEmail,
  };

  // Old deployments remain writable before migration 027: persona columns are
  // touched only when the existing row proves they exist, or an admin requests
  // an explicit persona assignment (which itself requires migration 027).
  const hasPersonaColumns =
    Boolean(input.authorPersonaId) ||
    Boolean(existing && Object.prototype.hasOwnProperty.call(existing, "author_persona_id"));
  if (hasPersonaColumns) {
    Object.assign(row, {
      author_persona_id: snapshot?.id ?? null,
      author_persona_version: snapshot?.version ?? null,
      author_persona_snapshot_json: snapshot,
      author_type: snapshot?.authorType ?? null,
      persona_selection_reason: snapshot
        ? emptyToNull(input.personaSelectionReason) ?? "Selected manually by an admin."
        : null,
      persona_generated: Boolean(snapshot && input.personaGenerated),
    });
  }

  if (input.status === "published" && !existing?.published_at) {
    row.published_at = new Date().toISOString();
  }

  if (!existing) row.created_by = actorEmail;

  const query = existing
    ? client.from("blog_posts").update(row).eq("id", existing.id)
    : client.from("blog_posts").insert(row);
  const { data, error } = await query.select("id, slug, status").single();
  if (error) throw mapDatabaseWriteError(error);

  return {
    id: data.id as string,
    slug: data.slug as string,
    status: data.status as BlogStatus,
    previousSlug: existing?.slug ?? null,
  };
}
