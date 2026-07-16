"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DOMAIN_FLAG_KEYS, type DomainFlagKey, type DomainFlags } from "@/lib/flag-keys";

const FLAG_META: Record<DomainFlagKey, { label: string; description: string }> = {
  domain_tech_enabled: {
    label: "Technology domain",
    description:
      "Shows the Technology tab and enables the /technology landing page. Turn on once tech laptops and programmes are ready.",
  },
  domain_mgmt_enabled: {
    label: "Management domain",
    description:
      "Shows the Management tab and enables the /management landing page. Turn on once management laptops and programmes are ready.",
  },
};

export function DomainFlagsForm({ initial }: { initial: DomainFlags }) {
  const [flags, setFlags] = useState<DomainFlags>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: DomainFlagKey, value: boolean) =>
    setFlags((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "domains", values: flags }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error ?? "Could not save domain flags.");
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
        <h3 className="text-sm font-medium text-foreground">Domains</h3>
        <p className="text-xs text-muted-foreground">
          Design is always live. Enable Technology and Management when each is ready.
        </p>
      </div>

      <div className="space-y-3">
        {DOMAIN_FLAG_KEYS.map((key) => (
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
        {saved ? "Saved!" : saving ? "Saving…" : "Save domains"}
      </Button>
    </div>
  );
}
