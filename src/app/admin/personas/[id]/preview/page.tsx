import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PersonaPreviewPanel } from "@/components/admin/personas/PersonaPreviewPanel";
import { getPersonaAdminEmail } from "@/lib/personas/admin-auth";
import { getPersonaById } from "@/lib/personas/service";

type Props = { params: Promise<{ id: string }> };

export default async function PersonaPreviewPage({ params }: Props) {
  if (!(await getPersonaAdminEmail())) redirect("/admin/login");
  const persona = await getPersonaById((await params).id);
  if (!persona) notFound();
  return <div className="space-y-5"><div><Link href={`/admin/personas/${persona.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"><ChevronLeft className="w-3 h-3" />Back to persona</Link><h1 className="text-xl font-bold">Preview {persona.displayName}</h1><p className="text-sm text-muted-foreground">Test the voice without saving or publishing a blog post.</p></div><PersonaPreviewPanel persona={persona} /></div>;
}
