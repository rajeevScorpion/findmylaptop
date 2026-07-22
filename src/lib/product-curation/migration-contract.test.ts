import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "034_add_product_curation.sql"), "utf8");
const rollback = readFileSync(join(process.cwd(), "supabase", "migrations", "034_add_product_curation_rollback.sql"), "utf8");

describe("product curation migration contract", () => {
  it("provides transactional forward and rollback paths", () => {
    expect(migration).toMatch(/\bBEGIN;[\s\S]*\bCOMMIT;\s*$/);
    expect(rollback).toMatch(/\bBEGIN;[\s\S]*\bCOMMIT;\s*$/);
  });

  it("starts all automation disabled and review controlled", () => {
    expect(migration).toContain("discovery_enabled BOOLEAN NOT NULL DEFAULT false");
    expect(migration).toContain("refresh_enabled BOOLEAN NOT NULL DEFAULT false");
    expect(migration).toContain("paused BOOLEAN NOT NULL DEFAULT true");
    expect(migration).toContain("status TEXT NOT NULL DEFAULT 'pending'");
  });

  it("enforces rate budgets and removes all introduced schema on rollback", () => {
    expect(migration).toContain("FUNCTION public.claim_source_api_budget");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(rollback).toContain("DROP TABLE IF EXISTS public.product_curation_rulebooks");
    expect(rollback).toContain("DROP COLUMN IF EXISTS target_domain");
  });
});
