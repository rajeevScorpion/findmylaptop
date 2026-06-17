"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Sparkles, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { BlockEditor } from "./BlockEditor";
import { BlockRenderer } from "@/components/blog/BlockRenderer";
import { slugify } from "@/lib/blog/slug";
import { buildToc, syncHeadingIds } from "@/lib/blog/toc";
import { readingTimeMinutes } from "@/lib/blog/slug";
import type { Block, BlogCategory, BlogContentDoc, BlogPost, BlogStatus } from "@/lib/blog/types";

const TEMPLATES = [
  "course_buying_guide",
  "budget_buying_guide",
  "use_case_guide",
  "comparison_guide",
  "parent_friendly_explainer",
  "spec_explainer",
];

const STATUSES: BlogStatus[] = ["draft", "ai_generated", "review", "published", "archived"];

interface BlogPostFormProps {
  post?: BlogPost;
  categories: BlogCategory[];
  userEmail: string;
  aiWriterEnabled: boolean;
  productBlocksEnabled: boolean;
}

const inputCls = "bg-background/50";
const labelCls = "text-xs text-muted-foreground";

export function BlogPostForm({
  post,
  categories,
  userEmail,
  aiWriterEnabled,
  productBlocksEnabled,
}: BlogPostFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post?.slug));
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [status, setStatus] = useState<BlogStatus>(post?.status ?? "draft");
  const [categoryId, setCategoryId] = useState(post?.category_id ?? "");
  const [primaryKeyword, setPrimaryKeyword] = useState(post?.primary_keyword ?? "");
  const [secondaryKeywords, setSecondaryKeywords] = useState((post?.secondary_keywords ?? []).join(", "));
  const [metaTitle, setMetaTitle] = useState(post?.meta_title ?? "");
  const [metaDescription, setMetaDescription] = useState(post?.meta_description ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(post?.og_image_url ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(post?.canonical_url ?? "");
  const [blocks, setBlocks] = useState<Block[]>(
    (post?.content_json as BlogContentDoc | null)?.blocks ?? []
  );

  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // AI panel state
  const [aiTopic, setAiTopic] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [aiAudience, setAiAudience] = useState("students, parents");
  const [aiTemplate, setAiTemplate] = useState(TEMPLATES[0]);
  const [aiIncludeProducts, setAiIncludeProducts] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const onTitleChange = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  async function callAi(generationType: "outline" | "draft" | "faqs" | "metadata") {
    setAiError(null);
    setAiBusy(generationType);
    try {
      const res = await fetch("/api/admin/blog/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationType,
          topic: aiTopic || title,
          brief: aiBrief,
          audience: aiAudience.split(",").map((s) => s.trim()).filter(Boolean),
          primaryKeyword,
          secondaryKeywords: secondaryKeywords.split(",").map((s) => s.trim()).filter(Boolean),
          templateType: aiTemplate,
          includeProducts: aiIncludeProducts,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error ?? "Generation failed.");
        return;
      }
      const result = json.result;
      if (generationType === "draft") {
        if (result.title && !title) onTitleChange(result.title);
        if (result.excerpt) setExcerpt(result.excerpt);
        setBlocks((result.content?.blocks ?? []) as Block[]);
        if (status === "draft") setStatus("ai_generated");
      } else if (generationType === "outline") {
        // Turn the outline into heading + empty paragraph blocks for editing.
        const next: Block[] = [];
        for (const o of result.outline ?? []) {
          next.push({ type: "heading", level: 2, text: o.heading, id: slugify(o.heading) });
          if (o.keyPoints?.length) next.push({ type: "bullets", items: o.keyPoints });
          else next.push({ type: "paragraph", text: "" });
        }
        setBlocks(next);
        if (result.title && !title) onTitleChange(result.title);
        if (status === "draft") setStatus("ai_generated");
      } else if (generationType === "faqs") {
        setBlocks((prev) => {
          const faq: Block = { type: "faq", items: result.items ?? [] };
          const idx = prev.findIndex((b) => b.type === "faq");
          if (idx >= 0) {
            const copy = prev.slice();
            copy[idx] = faq;
            return copy;
          }
          return [...prev, faq];
        });
      } else if (generationType === "metadata") {
        setMetaTitle(result.meta_title ?? metaTitle);
        setMetaDescription(result.meta_description ?? metaDescription);
      }
    } catch {
      setAiError("Network error. Please retry.");
    } finally {
      setAiBusy(null);
    }
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (!title.trim()) return setError("Title is required.");
    const cleanSlug = slugify(slug || title);
    if (!cleanSlug) return setError("A valid slug is required.");

    setSaving(true);
    const supabase = createClient();

    // Normalise content: sync heading ids, build toc + reading time.
    const doc: BlogContentDoc = syncHeadingIds({ type: "doc", blocks });
    const toc = buildToc(doc);
    const readingTime = readingTimeMinutes(doc);

    const nowIso = new Date().toISOString();
    const row: Record<string, unknown> = {
      title: title.trim(),
      slug: cleanSlug,
      excerpt: excerpt || null,
      content_json: doc,
      toc_json: toc,
      reading_time_minutes: readingTime,
      status,
      template_type: aiTemplate || null,
      audience: aiAudience.split(",").map((s) => s.trim()).filter(Boolean),
      primary_keyword: primaryKeyword || null,
      secondary_keywords: secondaryKeywords.split(",").map((s) => s.trim()).filter(Boolean),
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
      canonical_url: canonicalUrl || null,
      og_image_url: ogImageUrl || null,
      category_id: categoryId || null,
      updated_by: userEmail,
    };

    // Set published_at the first time a post becomes published.
    if (status === "published" && !post?.published_at) row.published_at = nowIso;

    let err;
    let newId = post?.id;
    if (post?.id) {
      ({ error: err } = await supabase.from("blog_posts").update(row).eq("id", post.id));
    } else {
      row.created_by = userEmail;
      const { data, error: insErr } = await supabase
        .from("blog_posts")
        .insert(row)
        .select("id")
        .single();
      err = insErr;
      newId = data?.id;
    }

    setSaving(false);
    if (err) {
      setError(err.message.includes("duplicate") ? "That slug is already in use." : err.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    if (!post?.id && newId) router.push(`/admin/blog/${newId}`);
    else router.refresh();
  }

  const previewDoc: BlogContentDoc = { type: "doc", blocks };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      {/* Main column */}
      <div className="space-y-5 min-w-0">
        {/* Title + slug */}
        <div className="glass-card rounded-xl border p-5 space-y-3">
          <div className="space-y-1.5">
            <Label className={labelCls}>Title</Label>
            <Input className={inputCls} value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Best laptop for B.Tech CSE students under ₹60,000" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Slug</Label>
            <Input className={inputCls} value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="best-laptop-for-btech-cse-students-under-60000" />
            {post?.status === "published" && (
              <p className="text-[11px] text-amber-500">
                This post is published — changing the slug will change its public URL.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Excerpt</Label>
            <Textarea className={inputCls} rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </div>
        </div>

        {/* AI panel */}
        {aiWriterEnabled && (
          <div className="glass-card rounded-xl border p-5 space-y-3 border-primary/30">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">AI assist</h3>
              <span className="text-[11px] text-muted-foreground">Drafts only — review before publishing</span>
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Topic</Label>
              <Input className={inputCls} value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Best laptop for B.Tech CSE students under ₹60,000" />
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Brief (optional)</Label>
              <Textarea className={inputCls} rows={2} value={aiBrief} onChange={(e) => setAiBrief(e.target.value)} placeholder="Target Indian students and parents. Use simple language." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className={labelCls}>Audience (comma separated)</Label>
                <Input className={inputCls} value={aiAudience} onChange={(e) => setAiAudience(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Template</Label>
                <select className="w-full bg-background/50 border border-input rounded-md text-sm h-9 px-2"
                  value={aiTemplate} onChange={(e) => setAiTemplate(e.target.value)}>
                  {TEMPLATES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={aiIncludeProducts} onChange={(e) => setAiIncludeProducts(e.target.checked)} disabled={!productBlocksEnabled} />
              Include product blocks {productBlocksEnabled ? "" : "(disabled by admin)"}
            </label>
            {aiError && <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{aiError}</p>}
            <div className="flex flex-wrap gap-2">
              {(["outline", "draft", "faqs", "metadata"] as const).map((g) => (
                <Button key={g} type="button" variant="outline" size="sm" disabled={Boolean(aiBusy)}
                  onClick={() => callAi(g)} className="gap-1.5 capitalize">
                  {aiBusy === g ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {g === "faqs" ? "FAQs" : g}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Content blocks / preview */}
        <div className="glass-card rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Content</h3>
            <div className="flex items-center rounded-lg border border-border/60 p-0.5 text-xs">
              <button type="button" onClick={() => setTab("edit")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md ${tab === "edit" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button type="button" onClick={() => setTab("preview")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md ${tab === "preview" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
            </div>
          </div>
          {tab === "edit" ? (
            <BlockEditor value={blocks} onChange={setBlocks} productBlocksEnabled={productBlocksEnabled} />
          ) : (
            <div className="rounded-lg border border-border/40 p-4">
              {blocks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nothing to preview yet.</p>
              ) : (
                <BlockRenderer blocks={previewDoc.blocks} adminPreview productBlocksEnabled={productBlocksEnabled} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar: publish + SEO */}
      <div className="space-y-5">
        <div className="glass-card rounded-xl border p-5 space-y-3 lg:sticky lg:top-6">
          <div className="space-y-1.5">
            <Label className={labelCls}>Status</Label>
            <select className="w-full bg-background/50 border border-input rounded-md text-sm h-9 px-2"
              value={status} onChange={(e) => setStatus(e.target.value as BlogStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">Only “published” posts appear publicly.</p>
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Category</Label>
            <select className="w-full bg-background/50 border border-input rounded-md text-sm h-9 px-2"
              value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{error}</p>}
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2 bg-primary text-primary-foreground hover:opacity-90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? "Saved!" : saving ? "Saving…" : "Save post"}
          </Button>
          {post?.status === "published" && (
            <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer"
              className="block text-center text-xs text-muted-foreground hover:text-foreground">
              View public page ↗
            </a>
          )}
        </div>

        <div className="glass-card rounded-xl border p-5 space-y-3">
          <h3 className="text-sm font-medium text-foreground">SEO</h3>
          <div className="space-y-1.5">
            <Label className={labelCls}>Primary keyword</Label>
            <Input className={inputCls} value={primaryKeyword} onChange={(e) => setPrimaryKeyword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Secondary keywords (comma separated)</Label>
            <Input className={inputCls} value={secondaryKeywords} onChange={(e) => setSecondaryKeywords(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Meta title</Label>
            <Input className={inputCls} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">{metaTitle.length} chars (aim ~50–60)</p>
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Meta description</Label>
            <Textarea className={inputCls} rows={3} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">{metaDescription.length} chars (aim ~140–160)</p>
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>OG image URL</Label>
            <Input className={inputCls} value={ogImageUrl} onChange={(e) => setOgImageUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Canonical URL (optional)</Label>
            <Input className={inputCls} value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}
