import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "033_add_research_novelty.sql"
);
const rollbackPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "033_add_research_novelty_rollback.sql"
);

describe("research novelty migration contract", () => {
  const migration = readFileSync(migrationPath, "utf8");
  const rollback = readFileSync(rollbackPath, "utf8");

  it("keeps forward and rollback changes transactional", () => {
    expect(migration).toMatch(/\bBEGIN;[\s\S]*\bCOMMIT;\s*$/);
    expect(rollback).toMatch(/\bBEGIN;[\s\S]*\bCOMMIT;\s*$/);
  });

  it("fences persistence with the active global novelty lease", () => {
    expect(migration).toContain(
      "v_novelty_lease public.research_novelty_lease%ROWTYPE"
    );
    expect(migration).toMatch(
      /FROM public\.research_novelty_lease[\s\S]*WHERE id = 1[\s\S]*FOR UPDATE;/
    );
    expect(migration).toContain(
      "v_novelty_lease.schedule_run_id IS DISTINCT FROM p_schedule_run_id"
    );
    expect(migration).toContain(
      "v_novelty_lease.execution_token IS DISTINCT FROM p_execution_token"
    );
    expect(migration).toContain(
      "v_novelty_lease.lease_expires_at <= clock_timestamp()"
    );
    expect(migration).toContain("MESSAGE = 'research_novelty_lease_stale'");
  });

  it("orders exact-title claims and removes every novelty object on rollback", () => {
    expect(
      migration.match(/char_length\(topic_fingerprint\) BETWEEN 1 AND 1024/g)
    ).toHaveLength(2);
    expect(migration).toContain(
      "ORDER BY public.research_topic_fingerprint(item.value->>'topic_title'), item.ordinal"
    );
    expect(rollback).toContain(
      "DROP FUNCTION IF EXISTS public.release_research_novelty_lease"
    );
    expect(rollback).toContain(
      "DROP FUNCTION IF EXISTS public.claim_research_novelty_lease"
    );
    expect(rollback).toContain(
      "DROP TABLE IF EXISTS public.research_novelty_lease"
    );
    expect(rollback).toContain("DROP TABLE IF EXISTS public.research_topic_claims");
    expect(rollback).toContain(
      "DROP FUNCTION IF EXISTS public.research_topic_fingerprint(TEXT)"
    );
  });
});
