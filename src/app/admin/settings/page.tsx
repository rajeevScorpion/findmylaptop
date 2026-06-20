import { createClient } from "@/lib/supabase/server";
import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";
import { BlogFlagsForm } from "@/components/admin/blog/BlogFlagsForm";
import { getBlogFlags } from "@/lib/flags";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("key, value");

  const settingsMap = Object.fromEntries(
    (settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value])
  );

  const flags = await getBlogFlags();

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Update global settings for the public site.
        </p>
      </div>
      <AdminSettingsForm
        whatsappUrl={settingsMap["whatsapp_url"] ?? ""}
        disclaimerText={settingsMap["disclaimer_text"] ?? ""}
        voiceInputEnabled={settingsMap["voice_input_enabled"] !== "false"}
      />
      <BlogFlagsForm initial={flags} />
    </div>
  );
}
