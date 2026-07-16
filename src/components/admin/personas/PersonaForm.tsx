"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, Eye, Loader2, Save, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { BlogAuthorPersona, PersonaAuthorType, PersonaStatus, PersonaUsage } from "@/lib/personas/types";

const inputClass = "bg-background/50";
const labelClass = "text-xs text-muted-foreground";

function csv(values: string[]): string {
  return values.join(", ");
}

function parseCsv(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function PersonaForm({ persona, usage }: { persona?: BlogAuthorPersona; usage?: PersonaUsage }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(persona?.displayName ?? "");
  const [slug, setSlug] = useState(persona?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(persona));
  const [publicRole, setPublicRole] = useState(persona?.publicRole ?? "");
  const [shortBio, setShortBio] = useState(persona?.shortBio ?? "");
  const [longDescription, setLongDescription] = useState(persona?.longInternalDescription ?? "");
  const [authorType, setAuthorType] = useState<PersonaAuthorType>(persona?.authorType ?? "ai_persona");
  const [status, setStatus] = useState<PersonaStatus>(persona?.status ?? "draft");
  const [avatarUrl, setAvatarUrl] = useState(persona?.avatarUrl ?? "");
  const [disclosureText, setDisclosureText] = useState(
    persona?.disclosureText ?? "LaptopFinder editorial persona — not a real individual."
  );
  const [expertiseTags, setExpertiseTags] = useState(csv(persona?.expertiseTags ?? []));
  const [audienceTags, setAudienceTags] = useState(csv(persona?.targetAudienceTags ?? []));
  const [categoryTags, setCategoryTags] = useState(csv(persona?.topicCategoryTags ?? []));
  const [softwareTags, setSoftwareTags] = useState(csv(persona?.softwareWorkflowTags ?? []));
  const [buyingPhilosophy, setBuyingPhilosophy] = useState(persona?.buyingPhilosophy ?? "");
  const [writingDos, setWritingDos] = useState(csv(persona?.writingDos ?? []));
  const [writingDonts, setWritingDonts] = useState(csv(persona?.writingDonts ?? []));
  const [systemPrompt, setSystemPrompt] = useState(persona?.personaSystemPrompt ?? "");
  const [formality, setFormality] = useState(persona?.toneSettings.formality ?? "friendly");
  const [depth, setDepth] = useState(persona?.toneSettings.depth ?? "intermediate");
  const [reassurance, setReassurance] = useState(
    persona?.toneSettings.reassuranceLevel ?? "medium"
  );
  const [technicalDensity, setTechnicalDensity] = useState(
    persona?.toneSettings.technicalDensity ?? "medium"
  );
  const [priorityWeight, setPriorityWeight] = useState(persona?.priorityWeight ?? 1);
  const [isDefault, setIsDefault] = useState(persona?.isDefaultFallback ?? false);
  const [allowAffiliate, setAllowAffiliate] = useState(
    persona?.affiliatePolicy.allowAffiliateLinks ?? false
  );
  const [maxProductCards, setMaxProductCards] = useState(
    persona?.affiliatePolicy.maxProductCards ?? 0
  );
  const [affiliateDisclosure, setAffiliateDisclosure] = useState(
    persona?.affiliatePolicy.requiredDisclosureText ?? ""
  );
  const [canWriteBlogs, setCanWriteBlogs] = useState(persona?.permissions.canWriteBlogs ?? true);
  const [canWriteComparisons, setCanWriteComparisons] = useState(
    persona?.permissions.canWriteComparisons ?? false
  );
  const [canInsertProducts, setCanInsertProducts] = useState(
    persona?.permissions.canInsertProductCards ?? false
  );
  const [canAutoSchedule, setCanAutoSchedule] = useState(
    persona?.permissions.canBeAutoScheduled ?? false
  );
  const [alwaysReview, setAlwaysReview] = useState(
    persona?.permissions.alwaysRequiresManualReview ?? true
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function payload() {
    return {
      displayName: displayName.trim(),
      slug: slugify(slug || displayName),
      publicRole: publicRole.trim(),
      shortBio: shortBio.trim(),
      longInternalDescription: longDescription.trim() || null,
      authorType,
      status,
      avatarUrl: avatarUrl.trim() || null,
      disclosureText: disclosureText.trim(),
      expertiseTags: parseCsv(expertiseTags),
      targetAudienceTags: parseCsv(audienceTags),
      topicCategoryTags: parseCsv(categoryTags),
      softwareWorkflowTags: parseCsv(softwareTags),
      toneSettings: {
        formality,
        depth,
        reassuranceLevel: reassurance,
        technicalDensity,
      },
      buyingPhilosophy: buyingPhilosophy.trim(),
      writingDos: parseCsv(writingDos),
      writingDonts: parseCsv(writingDonts),
      personaSystemPrompt: systemPrompt.trim(),
      affiliatePolicy: {
        allowAffiliateLinks: allowAffiliate,
        maxProductCards,
        requiredDisclosureText: affiliateDisclosure.trim(),
      },
      permissions: {
        canWriteBlogs,
        canWriteComparisons,
        canInsertProductCards: canInsertProducts,
        canBeAutoScheduled: canAutoSchedule,
        alwaysRequiresManualReview: alwaysReview,
      },
      priorityWeight,
      isDefaultFallback: isDefault,
    };
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(
        persona ? `/api/admin/personas/${persona.id}` : "/api/admin/personas",
        {
          method: persona ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        }
      );
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? "Could not save persona.");
        return;
      }
      setSaved(true);
      if (!persona) router.push(`/admin/personas/${json.persona.id}`);
      else router.refresh();
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "disable" | "archive" | "soft_delete" | "restore" | "hard_delete") {
    if (!persona) return;
    if (action === "hard_delete" && !window.confirm("Permanently delete this unused persona? This cannot be undone.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/personas/${persona.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? "Could not update persona.");
        return;
      }
      if (json.deleted) router.push("/admin/personas");
      else {
        setStatus(json.persona.status);
        router.refresh();
      }
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  const toggleRows = [
    ["Can write blogs", canWriteBlogs, setCanWriteBlogs],
    ["Can write comparisons", canWriteComparisons, setCanWriteComparisons],
    ["Can insert product cards", canInsertProducts, setCanInsertProducts],
    ["Can be auto-scheduled", canAutoSchedule, setCanAutoSchedule],
    ["Always requires manual review", alwaysReview, setAlwaysReview],
  ] as const;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="glass-card rounded-xl border p-5 space-y-4">
        <h2 className="text-sm font-semibold">Public author profile</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Display name">
            <Input
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Slug">
            <Input
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugTouched(true);
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Public role/title">
            <Input value={publicRole} onChange={(e) => setPublicRole(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Avatar URL (optional)">
            <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Author type">
            <select value={authorType} onChange={(e) => setAuthorType(e.target.value as PersonaAuthorType)} className="w-full h-9 rounded-md border border-input bg-background/50 px-2 text-sm">
              <option value="ai_persona">AI/editorial persona</option>
              <option value="human">Human</option>
              <option value="brand">Brand</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as PersonaStatus)} className="w-full h-9 rounded-md border border-input bg-background/50 px-2 text-sm">
              {(["draft", "active", "disabled", "archived", "soft_deleted"] as PersonaStatus[]).map((value) => (
                <option key={value} value={value}>{value.replace("_", " ")}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Short public bio">
          <Textarea value={shortBio} onChange={(e) => setShortBio(e.target.value)} rows={3} className={inputClass} />
        </Field>
        <Field label="Required public disclosure">
          <Textarea value={disclosureText} onChange={(e) => setDisclosureText(e.target.value)} rows={2} className={inputClass} />
          <p className="text-[11px] text-muted-foreground mt-1">Fictional personas must be identified as LaptopFinder editorial personas.</p>
        </Field>
      </div>

      <div className="glass-card rounded-xl border p-5 space-y-4">
        <h2 className="text-sm font-semibold">Selection and expertise</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Expertise tags (comma separated)"><Input value={expertiseTags} onChange={(e) => setExpertiseTags(e.target.value)} className={inputClass} /></Field>
          <Field label="Audience tags"><Input value={audienceTags} onChange={(e) => setAudienceTags(e.target.value)} className={inputClass} /></Field>
          <Field label="Topic/category tags"><Input value={categoryTags} onChange={(e) => setCategoryTags(e.target.value)} className={inputClass} /></Field>
          <Field label="Software/workflow tags"><Input value={softwareTags} onChange={(e) => setSoftwareTags(e.target.value)} className={inputClass} /></Field>
          <Field label="Priority weight"><Input type="number" min={0} max={1000} value={priorityWeight} onChange={(e) => setPriorityWeight(Number(e.target.value))} className={inputClass} /></Field>
          <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
            <div><p className="text-sm">Default fallback</p><p className="text-[11px] text-muted-foreground">Only one persona can be the fallback.</p></div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl border p-5 space-y-4">
        <h2 className="text-sm font-semibold">Voice and writing behavior</h2>
        <Field label="Internal description"><Textarea value={longDescription} onChange={(e) => setLongDescription(e.target.value)} rows={3} className={inputClass} /></Field>
        <Field label="Buying philosophy"><Textarea value={buyingPhilosophy} onChange={(e) => setBuyingPhilosophy(e.target.value)} rows={3} className={inputClass} /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Writing dos (comma separated)"><Textarea value={writingDos} onChange={(e) => setWritingDos(e.target.value)} rows={3} className={inputClass} /></Field>
          <Field label="Writing don'ts (comma separated)"><Textarea value={writingDonts} onChange={(e) => setWritingDonts(e.target.value)} rows={3} className={inputClass} /></Field>
        </div>
        <Field label="Persona system guidance"><Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={6} className={inputClass} /></Field>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ToneSelect label="Formality" value={formality} onChange={setFormality} options={["friendly", "professional", "academic", "technical"]} />
          <ToneSelect label="Depth" value={depth} onChange={setDepth} options={["basic", "intermediate", "advanced"]} />
          <ToneSelect label="Reassurance" value={reassurance} onChange={setReassurance} options={["low", "medium", "high"]} />
          <ToneSelect label="Technical density" value={technicalDensity} onChange={setTechnicalDensity} options={["low", "medium", "high"]} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass-card rounded-xl border p-5 space-y-3">
          <h2 className="text-sm font-semibold">Permissions</h2>
          {toggleRows.map(([label, value, setter]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-1">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Switch checked={value} onCheckedChange={setter} />
            </div>
          ))}
        </div>
        <div className="glass-card rounded-xl border p-5 space-y-3">
          <h2 className="text-sm font-semibold">Affiliate policy</h2>
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Allow affiliate links</span><Switch checked={allowAffiliate} onCheckedChange={setAllowAffiliate} /></div>
          <Field label="Maximum product cards"><Input type="number" min={0} max={12} value={maxProductCards} onChange={(e) => setMaxProductCards(Number(e.target.value))} className={inputClass} /></Field>
          <Field label="Required affiliate disclosure"><Textarea value={affiliateDisclosure} onChange={(e) => setAffiliateDisclosure(e.target.value)} rows={3} className={inputClass} /></Field>
        </div>
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</p>}
      {persona && usage && usage.totalPosts > 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          This persona is used by {usage.totalPosts} post{usage.totalPosts === 1 ? "" : "s"} ({usage.publishedCount} published, {usage.draftCount} drafts). Archive or soft-delete preserves attribution; hard delete is blocked until every dependency is reassigned.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved" : persona ? "Save persona" : "Create persona"}
        </Button>
        {persona && (
          <Link className={buttonVariants({ variant: "outline", className: "gap-2" })} href={`/admin/personas/${persona.id}/preview`}><Eye className="w-4 h-4" />Preview writing</Link>
        )}
        {persona && status !== "soft_deleted" && <Button variant="outline" onClick={() => runAction("archive")} disabled={busy} className="gap-2"><Archive className="w-4 h-4" />Archive</Button>}
        {persona && status !== "soft_deleted" && <Button variant="outline" onClick={() => runAction("soft_delete")} disabled={busy}>Soft delete</Button>}
        {persona && status === "soft_deleted" && <Button variant="outline" onClick={() => runAction("restore")} disabled={busy}>Restore as draft</Button>}
        {persona && !persona.isDefaultFallback && <Button variant="destructive" onClick={() => runAction("hard_delete")} disabled={busy || Boolean(usage?.totalPosts)} className="gap-2"><Trash2 className="w-4 h-4" />Hard delete if unused</Button>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className={labelClass}>{label}</Label>{children}</div>;
}

function ToneSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: never) => void; options: string[] }) {
  return <Field label={label}><select value={value} onChange={(e) => onChange(e.target.value as never)} className="w-full h-9 rounded-md border border-input bg-background/50 px-2 text-sm">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>;
}
