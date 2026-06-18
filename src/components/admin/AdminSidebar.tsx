"use client";

import { useRouter, usePathname } from "next/navigation";
import { Cpu, LayoutDashboard, Laptop, Settings, LogOut, Menu, X, MessageSquare, RefreshCw, FileText } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/laptops", label: "Laptops", icon: Laptop, exact: false },
  { href: "/admin/blog", label: "Blog", icon: FileText, exact: false, flag: "blog" as const },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare, exact: false },
  { href: "/admin/refresh-prices", label: "Refresh Prices", icon: RefreshCw, exact: false },
  { href: "/admin/settings", label: "Settings", icon: Settings, exact: false },
];

interface AdminSidebarProps {
  userEmail: string;
  blogEnabled?: boolean;
}

export function AdminSidebar({ userEmail, blogEnabled = false }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border/30">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Cpu className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">FindMyLaptop</p>
          <p className="text-xs text-muted-foreground truncate">Admin</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.filter((item) => ("flag" in item ? blogEnabled : true)).map(({ href, label, icon: Icon, exact }) => (
          <a
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive(href, exact)
                ? "bg-primary/15 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </a>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-border/30 space-y-2">
        <p className="px-3 text-xs text-muted-foreground truncate">{userEmail}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-56 flex-col bg-sidebar border-r border-border/30 z-20">
        <SidebarContent />
      </aside>

      {/* Mobile nav button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass-card border"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 h-full w-56 flex flex-col bg-sidebar border-r border-border/30 z-50">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}
