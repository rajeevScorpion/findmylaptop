"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";

interface AdminSettingsFormProps {
  whatsappUrl: string;
  disclaimerText: string;
  voiceInputEnabled: boolean;
  workloadFilterEnabled: boolean;
}

export function AdminSettingsForm({ whatsappUrl, disclaimerText, voiceInputEnabled, workloadFilterEnabled }: AdminSettingsFormProps) {
  const [waUrl, setWaUrl] = useState(whatsappUrl);
  const [disclaimer, setDisclaimer] = useState(disclaimerText);
  const [voiceEnabled, setVoiceEnabled] = useState(voiceInputEnabled);
  const [workloadEnabled, setWorkloadEnabled] = useState(workloadFilterEnabled);
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
      { key: "voice_input_enabled", value: voiceEnabled ? "true" : "false" },
      { key: "workload_filter_enabled", value: workloadEnabled ? "true" : "false" },
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
    fetch("/api/admin/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: "settings" }),
    });
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

      <div className="glass-card rounded-xl border p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Chat (Chip)</h3>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-foreground">Voice input</p>
            <p className="text-xs text-muted-foreground">
              Shows a mic button in the chat. Tapping it records the user&rsquo;s voice, transcribes
              it with Whisper, and sends the message automatically.
            </p>
          </div>
          <Switch
            checked={voiceEnabled}
            onCheckedChange={(v: boolean) => setVoiceEnabled(v)}
            className="mt-1 shrink-0"
          />
        </div>
      </div>

      <div className="glass-card rounded-xl border p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Guided Finder</h3>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-foreground">Workload filter</p>
            <p className="text-xs text-muted-foreground">
              Shows the &ldquo;Workload&rdquo; chips in the advanced filters. Currently hidden while we
              rework how workload should influence ranking. Applies to all domains.
            </p>
          </div>
          <Switch
            checked={workloadEnabled}
            onCheckedChange={(v: boolean) => setWorkloadEnabled(v)}
            className="mt-1 shrink-0"
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
