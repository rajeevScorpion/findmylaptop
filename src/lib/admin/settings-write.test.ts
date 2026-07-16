import { describe, expect, it } from "vitest";
import { adminSettingsWriteSchema } from "./settings-write";

const blogValues = {
  blog_enabled: true,
  blog_public_enabled: false,
  ai_blog_writer_enabled: false,
  blog_product_blocks_enabled: false,
  blog_schema_enabled: true,
  blog_auto_sitemap_enabled: true,
};

describe("adminSettingsWriteSchema", () => {
  it("accepts only the complete blog flag allowlist", () => {
    expect(
      adminSettingsWriteSchema.safeParse({ section: "blog", values: blogValues }).success
    ).toBe(true);

    expect(
      adminSettingsWriteSchema.safeParse({
        section: "blog",
        values: { ...blogValues, arbitrary_setting: true },
      }).success
    ).toBe(false);
  });

  it("does not permit keys from another settings section", () => {
    expect(
      adminSettingsWriteSchema.safeParse({
        section: "domains",
        values: { domain_tech_enabled: true, domain_mgmt_enabled: false, ...blogValues },
      }).success
    ).toBe(false);
  });

  it("bounds and validates the general settings values", () => {
    expect(
      adminSettingsWriteSchema.safeParse({
        section: "general",
        values: {
          whatsapp_url: "https://chat.whatsapp.com/example",
          disclaimer_text: "Editorial disclaimer",
          voice_input_enabled: true,
          workload_filter_enabled: false,
        },
      }).success
    ).toBe(true);

    expect(
      adminSettingsWriteSchema.safeParse({
        section: "general",
        values: {
          whatsapp_url: "javascript:alert(1)",
          disclaimer_text: "Editorial disclaimer",
          voice_input_enabled: true,
          workload_filter_enabled: false,
        },
      }).success
    ).toBe(false);
  });
});
