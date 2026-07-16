import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_ADMIN_SETTINGS_REQUEST_BYTES = 16 * 1024;

const generalValuesSchema = z
  .object({
    whatsapp_url: z
      .string()
      .trim()
      .max(2_048)
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      }, "WhatsApp URL must be an HTTP or HTTPS URL"),
    disclaimer_text: z.string().max(5_000),
    voice_input_enabled: z.boolean(),
    workload_filter_enabled: z.boolean(),
  })
  .strict();

const domainValuesSchema = z
  .object({
    domain_tech_enabled: z.boolean(),
    domain_mgmt_enabled: z.boolean(),
  })
  .strict();

const blogValuesSchema = z
  .object({
    blog_enabled: z.boolean(),
    blog_public_enabled: z.boolean(),
    ai_blog_writer_enabled: z.boolean(),
    blog_product_blocks_enabled: z.boolean(),
    blog_schema_enabled: z.boolean(),
    blog_auto_sitemap_enabled: z.boolean(),
  })
  .strict();

export const adminSettingsWriteSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("general"), values: generalValuesSchema }).strict(),
  z.object({ section: z.literal("domains"), values: domainValuesSchema }).strict(),
  z.object({ section: z.literal("blog"), values: blogValuesSchema }).strict(),
]);

export type AdminSettingsWriteInput = z.infer<typeof adminSettingsWriteSchema>;

function toRows(input: AdminSettingsWriteInput, updatedAt: string) {
  if (input.section === "general") {
    return [
      { key: "whatsapp_url", value: input.values.whatsapp_url, updated_at: updatedAt },
      { key: "disclaimer_text", value: input.values.disclaimer_text, updated_at: updatedAt },
      {
        key: "voice_input_enabled",
        value: input.values.voice_input_enabled ? "true" : "false",
        updated_at: updatedAt,
      },
      {
        key: "workload_filter_enabled",
        value: input.values.workload_filter_enabled ? "true" : "false",
        updated_at: updatedAt,
      },
    ];
  }

  return Object.entries(input.values).map(([key, value]) => ({
    key,
    value: value ? "true" : "false",
    updated_at: updatedAt,
  }));
}

export class AdminSettingsWriteError extends Error {
  constructor() {
    super("Could not save settings.");
    this.name = "AdminSettingsWriteError";
  }
}

export async function writeAdminSettings(
  input: AdminSettingsWriteInput,
  client: ReturnType<typeof createAdminClient> = createAdminClient()
): Promise<void> {
  const rows = toRows(input, new Date().toISOString());
  const { error } = await client.from("settings").upsert(rows, { onConflict: "key" });
  if (error) throw new AdminSettingsWriteError();
}
