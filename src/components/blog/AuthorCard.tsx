import Link from "next/link";
import { Bot, Info, UserRound } from "lucide-react";
import type { PersonaPublicSnapshot } from "@/lib/personas/types";
import { combineEditorialDisclosure } from "@/lib/blog/editorial-card";
import { cn } from "@/lib/utils";

interface AuthorCardProps {
  persona: PersonaPublicSnapshot;
  generatedDisclosure?: string | null;
  className?: string;
}

export function AuthorCard({
  persona,
  generatedDisclosure,
  className,
}: AuthorCardProps) {
  const isHuman = persona.authorType === "human";
  const disclosure = combineEditorialDisclosure(
    persona.disclosureText,
    generatedDisclosure
  );

  return (
    <aside
      aria-label={`About ${persona.displayName}`}
      className={cn(
        "rounded-xl border border-border/50 bg-muted/20 p-4 sm:p-5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-background text-primary">
          {persona.avatarUrl ? (
            // Persona avatars are admin-managed URLs and may come from several
            // storage hosts, so a native image avoids a brittle host allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={persona.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : isHuman ? (
            <UserRound className="h-5 w-5" />
          ) : (
            <Bot className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/blog/author/${persona.slug}`}
              className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
            >
              {persona.displayName}
            </Link>
            {!isHuman && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                {persona.authorType === "brand" ? "Editorial team" : "AI editorial persona"}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {persona.publicRole}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {persona.shortBio}
          </p>
          {persona.expertiseTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {persona.expertiseTags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {disclosure && (
            <div className="mt-3 border-t border-border/50 pt-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
                Editorial disclosure
              </p>
              <p className="mt-1 break-words whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground/90">
                {disclosure}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
