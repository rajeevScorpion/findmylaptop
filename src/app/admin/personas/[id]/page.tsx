import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PersonaForm } from "@/components/admin/personas/PersonaForm";
import { getPersonaAdminEmail } from "@/lib/personas/admin-auth";
import { getPersonaById, getPersonaUsage } from "@/lib/personas/service";

type Props = { params: Promise<{ id: string }> };

export default async function EditPersonaPage({ params }: Props) {
  if (!(await getPersonaAdminEmail())) redirect("/admin/login");
  const id = (await params).id;
  const [persona, usage] = await Promise.all([
    getPersonaById(id),
    getPersonaUsage(id),
  ]);
  if (!persona) notFound();
  return <div className="space-y-5"><div><Link href="/admin/personas" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"><ChevronLeft className="w-3 h-3" />Back to personas</Link><h1 className="text-xl font-bold">Edit {persona.displayName}</h1><p className="text-sm text-muted-foreground">Version {persona.version}. Saving creates a new immutable version snapshot.</p></div><PersonaForm persona={persona} usage={usage} /></div>;
}
