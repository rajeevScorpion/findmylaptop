import { createClient } from "@/lib/supabase/server";
import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("key, value");

  const settingsMap = Object.fromEntries(
    (settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value])
  );

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
      />
    </div>
  );
}
