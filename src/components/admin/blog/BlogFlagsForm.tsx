"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BLOG_FLAG_KEYS, type BlogFlagKey, type BlogFlags } from "@/lib/flag-keys";

const FLAG_META: Record<BlogFlagKey, { label: string; description: string }> = {
  blog_enabled: {
    label: "Blog CMS",
    description: "Master switch. When off, the admin blog section and all blog routes are disabled.",
  },
  blog_public_enabled: {
    label: "Public blog",
    description: "Controls whether published posts are visible to users and search engines.",
  },
  ai_blog_writer_enabled: {
    label: "AI blog writer",
    description: "Lets admins generate outlines, drafts, FAQs, and metadata. AI content still needs manual review before publishing.",
  },
  blog_product_blocks_enabled: {
    label: "Product blocks",
    description: "Shows product-card placeholder blocks in the editor and renders them publicly.",
  },
  blog_schema_enabled: {
    label: "Structured data (JSON-LD)",
    description: "Renders Article, Breadcrumb, and FAQ schema on published posts.",
  },
  blog_auto_sitemap_enabled: {
    label: "Sitemap inclusion",
    description: "Includes published blog posts in the sitemap.",
  },
};

export function BlogFlagsForm({ initial }: { initial: BlogFlags }) {
  const [flags, setFlags] = useState<BlogFlags>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: BlogFlagKey, value: boolean) =>
    setFlags((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "blog", values: flags }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error ?? "Could not save blog flags.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card rounded-xl border p-5 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Blog &amp; AI</h3>
        <p className="text-xs text-muted-foreground">Toggle blog/CMS and AI writer features.</p>
      </div>

      <div className="space-y-3">
        {BLOG_FLAG_KEYS.map((key) => (
          <div key={key} className="flex items-start justify-between gap-4 py-1.5">
            <div className="min-w-0">
              <p className="text-sm text-foreground">{FLAG_META[key].label}</p>
              <p className="text-xs text-muted-foreground">{FLAG_META[key].description}</p>
            </div>
            <Switch
              checked={flags[key]}
              onCheckedChange={(v: boolean) => toggle(key, v)}
              className="mt-1 shrink-0"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}

      <Button onClick={handleSave} disabled={saving} className="gap-2 bg-primary text-primary-foreground hover:opacity-90">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? "Saved!" : saving ? "Saving…" : "Save flags"}
      </Button>
    </div>
  );
}
