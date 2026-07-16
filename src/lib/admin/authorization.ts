import "server-only";

import { createClient } from "@/lib/supabase/server";

interface AdminAuthUser {
  id: string;
  email?: string | null;
}
export interface AdminAuthClient {
  auth: {
    getUser(): Promise<{
      data: { user: AdminAuthUser | null };
      error: unknown | null;
    }>;
  };
}

export interface AdminIdentity {
  id: string;
  email: string;
}

export type AdminAuthorizationErrorCode = "UNAUTHORIZED" | "FORBIDDEN";

export class AdminAuthorizationError extends Error {
  readonly code: AdminAuthorizationErrorCode;
  readonly status: 401 | 403;

  constructor(code: AdminAuthorizationErrorCode) {
    super(code === "UNAUTHORIZED" ? "Unauthorized" : "Forbidden");
    this.name = "AdminAuthorizationError";
    this.code = code;
    this.status = code === "UNAUTHORIZED" ? 401 : 403;
  }
}

export interface RequireAdminOptions {
  client?: AdminAuthClient;
  adminEmails?: string | Iterable<string>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Parse ADMIN_EMAILS; an absent/empty value deliberately produces no admins. */
export function parseAdminEmails(
  value: string | Iterable<string> | undefined = process.env.ADMIN_EMAILS
): ReadonlySet<string> {
  const values =
    typeof value === "string" ? value.split(",") : value ? [...value] : [];

  return new Set(values.map(normalizeEmail).filter(Boolean));
}

export function isAdminEmail(
  email: string | null | undefined,
  adminEmails?: string | Iterable<string>
): boolean {
  if (!email) return false;
  return parseAdminEmails(adminEmails).has(normalizeEmail(email));
}

/**
 * Perform a secure Supabase user lookup and then enforce the server-side
 * ADMIN_EMAILS allowlist. This must be called at every privileged entry point.
 */
export async function requireAdmin(
  options: RequireAdminOptions = {}
): Promise<AdminIdentity> {
  const client: AdminAuthClient = options.client ?? (await createClient());

  let result: Awaited<ReturnType<AdminAuthClient["auth"]["getUser"]>>;
  try {
    result = await client.auth.getUser();
  } catch {
    throw new AdminAuthorizationError("UNAUTHORIZED");
  }

  const user = result.data.user;
  if (result.error || !user) {
    throw new AdminAuthorizationError("UNAUTHORIZED");
  }

  const email = user.email?.trim();
  if (!email || !isAdminEmail(email, options.adminEmails)) {
    throw new AdminAuthorizationError("FORBIDDEN");
  }

  return { id: user.id, email };
}

export function isAdminAuthorizationError(
  error: unknown
): error is AdminAuthorizationError {
  return error instanceof AdminAuthorizationError;
}

export function adminAuthorizationErrorResponse(
  error: unknown
): Response | null {
  if (!isAdminAuthorizationError(error)) return null;

  return Response.json(
    { error: error.message },
    {
      status: error.status,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
