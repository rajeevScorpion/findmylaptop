import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getBlogFlags } from "@/lib/flags";

function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  // Don't auth-check the login page — it's under this layout but must be public
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (!isAdminEmail(user.email ?? "")) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="glass-card rounded-2xl border p-8 text-center max-w-sm space-y-3">
          <p className="text-lg font-semibold text-foreground">Access Denied</p>
          <p className="text-sm text-muted-foreground">
            Your account ({user.email}) is not authorised to access the admin panel.
          </p>
        </div>
      </div>
    );
  }

  const flags = await getBlogFlags();

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar userEmail={user.email ?? ""} blogEnabled={flags.blog_enabled} />
      <main className="flex-1 pt-16 px-4 pb-6 lg:pt-8 lg:px-8 lg:pb-8 ml-0 lg:ml-56">
        {children}
      </main>
    </div>
  );
}
