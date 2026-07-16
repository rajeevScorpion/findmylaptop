import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PersonaForm } from "@/components/admin/personas/PersonaForm";
import { getPersonaAdminEmail } from "@/lib/personas/admin-auth";

export default async function NewPersonaPage() {
  if (!(await getPersonaAdminEmail())) redirect("/admin/login");
  return <div className="space-y-5"><div><Link href="/admin/personas" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"><ChevronLeft className="w-3 h-3" />Back to personas</Link><h1 className="text-xl font-bold">Create persona</h1><p className="text-sm text-muted-foreground">Create a clearly disclosed editorial, human, or brand author profile.</p></div><PersonaForm /></div>;
}
