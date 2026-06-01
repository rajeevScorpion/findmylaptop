"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

interface AdminSettingsFormProps {
  whatsappUrl: string;
  disclaimerText: string;
}

export function AdminSettingsForm({ whatsappUrl, disclaimerText }: AdminSettingsFormProps) {
  const [waUrl, setWaUrl] = useState(whatsappUrl);
  const [disclaimer, setDisclaimer] = useState(disclaimerText);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();

    const updates = [
      { key: "whatsapp_url", value: waUrl },
      { key: "disclaimer_text", value: disclaimer },
    ];

    for (const update of updates) {
      const { error: err } = await supabase
        .from("settings")
        .upsert({ key: update.key, value: update.value, updated_at: new Date().toISOString() });
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-xl border p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground">WhatsApp Group</h3>
        <div className="space-y-1.5">
          <Label htmlFor="waUrl" className="text-xs text-muted-foreground">
            WhatsApp Group / Chat URL
          </Label>
          <Input
            id="waUrl"
            value={waUrl}
            onChange={(e) => setWaUrl(e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
            className="bg-background/50"
          />
          <p className="text-xs text-muted-foreground">
            This link appears on the public site as a &ldquo;Join WhatsApp group&rdquo; CTA.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-xl border p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Disclaimer</h3>
        <div className="space-y-1.5">
          <Label htmlFor="disclaimer" className="text-xs text-muted-foreground">
            Footer Disclaimer Text
          </Label>
          <Textarea
            id="disclaimer"
            value={disclaimer}
            onChange={(e) => setDisclaimer(e.target.value)}
            rows={4}
            className="bg-background/50 resize-y text-xs"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>
      )}

      <Button
        onClick={handleSave}
        disabled={saving}
        className="gap-2 bg-primary text-primary-foreground hover:opacity-90"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? "Saved!" : saving ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}
