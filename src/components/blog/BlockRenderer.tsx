import Link from "next/link";
import {
  Laptop,
  Lightbulb,
  Info,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Wallet,
  GraduationCap,
  Cpu,
  ArrowRight,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import type {
  Block,
  CalloutBlock,
  CardBlock,
  CtaBlock,
  FaqBlock,
  UnknownBlock,
} from "@/lib/blog/types";
import type { Laptop as LaptopProduct } from "@/lib/types";
import { LaptopMiniCard } from "@/components/public/LaptopMiniCard";
import { selectProductsForIntent } from "@/lib/blog/product-intent";

// Curated icon map — AI/admin supply an icon name string; unknown names fall
// back to a neutral icon. Keeps lucide tree-shakeable and avoids dynamic eval.
const ICONS: Record<string, LucideIcon> = {
  Laptop,
  Lightbulb,
  Info,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Wallet,
  GraduationCap,
  Cpu,
};

function Icon({ name, className }: { name?: string; className?: string }) {
  const Cmp = (name && ICONS[name]) || Sparkles;
  return <Cmp className={className} />;
}

const CALLOUT_STYLE: Record<
  CalloutBlock["variant"],
  { wrap: string; icon: LucideIcon; iconClass: string }
> = {
  info: { wrap: "border-primary/30 bg-primary/5", icon: Info, iconClass: "text-primary" },
  warning: {
    wrap: "border-amber-500/30 bg-amber-500/5",
    icon: AlertTriangle,
    iconClass: "text-amber-500",
  },
  tip: {
    wrap: "border-emerald-500/30 bg-emerald-500/5",
    icon: Lightbulb,
    iconClass: "text-emerald-500",
  },
};

function CardView({ block }: { block: CardBlock }) {
  return (
    <div className="glass-card rounded-2xl border p-5 my-6">
      {(block.icon || block.title) && (
        <div className="flex items-center gap-2 mb-2">
          {block.icon && <Icon name={block.icon} className="w-5 h-5 text-primary shrink-0" />}
          {block.title && (
            <p className="text-sm font-semibold text-foreground">{block.title}</p>
          )}
        </div>
      )}
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
        {block.content}
      </p>
    </div>
  );
}

function CalloutView({ block }: { block: CalloutBlock }) {
  const s = CALLOUT_STYLE[block.variant] ?? CALLOUT_STYLE.info;
  const CIcon = s.icon;
  return (
    <div className={`rounded-xl border p-4 my-6 flex gap-3 ${s.wrap}`}>
      <CIcon className={`w-5 h-5 shrink-0 mt-0.5 ${s.iconClass}`} />
      <div>
        {block.title && (
          <p className="text-sm font-semibold text-foreground mb-1">{block.title}</p>
        )}
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {block.content}
        </p>
      </div>
    </div>
  );
}

function FaqView({ block }: { block: FaqBlock }) {
  if (!block.items?.length) return null;
  return (
    <div className="my-8 space-y-3">
      {block.items.map((item, i) => (
        <details
          key={i}
          className="group glass-card rounded-xl border px-4 py-3 [&_summary]:list-none"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-foreground">
            {item.question}
            <ArrowRight className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}

function CtaView({ block }: { block: CtaBlock }) {
  return (
    <div className="hero-gradient glass-card rounded-2xl border p-6 my-8 text-center">
      <p className="text-lg font-semibold text-foreground mb-1">{block.title}</p>
      {block.body && <p className="text-sm text-muted-foreground mb-4">{block.body}</p>}
      <Link
        href={block.href || "/"}
        className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        {block.label || "Open LaptopFinder"}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function ProductGridView({
  picks,
  intent,
  adminPreview,
}: {
  picks: LaptopProduct[];
  intent?: string;
  adminPreview: boolean;
}) {
  return (
    <div className="my-8">
      <div className="flex items-center gap-2 mb-3">
        <ShoppingBag className="w-4 h-4 text-primary shrink-0" />
        <p className="text-sm font-semibold text-foreground">Recommended laptops</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {picks.map((laptop) => (
          <LaptopMiniCard key={laptop.id} laptop={laptop} />
        ))}
      </div>
      {adminPreview && (
        <p className="mt-2 text-[11px] italic text-muted-foreground">
          Auto-selected from intent: “{intent || "—"}”. Updates automatically as your catalog
          changes.
        </p>
      )}
    </div>
  );
}

interface BlockRendererProps {
  blocks: unknown[];
  // Published laptops used to populate product blocks from their stored intent.
  laptops?: LaptopProduct[];
  // In admin preview we render a labelled placeholder for unknown/disabled
  // blocks; on the public page they are skipped silently.
  adminPreview?: boolean;
  productBlocksEnabled?: boolean;
}

const KNOWN_TYPES = new Set<Block["type"]>([
  "hero",
  "heading",
  "paragraph",
  "bullets",
  "numbered",
  "card",
  "callout",
  "faq",
  "cta",
  "product_grid_placeholder",
]);

export function BlockRenderer({
  blocks,
  laptops = [],
  adminPreview = false,
  productBlocksEnabled = false,
}: BlockRendererProps) {
  return (
    <>
      {blocks.map((raw, i) => {
        const block = raw as Block | UnknownBlock;
        const type = (block as { type?: string })?.type;

        // Unknown / future blocks: never crash. Placeholder in admin, hidden public.
        if (!type || !KNOWN_TYPES.has(type as Block["type"])) {
          if (!adminPreview) return null;
          return (
            <div
              key={i}
              className="rounded-xl border border-dashed border-border/60 p-4 my-4 text-xs text-muted-foreground"
            >
              Unsupported block type{type ? `: "${type}"` : ""} — hidden on the public page.
            </div>
          );
        }

        switch ((block as Block).type) {
          case "hero": {
            const b = block as Extract<Block, { type: "hero" }>;
            return (
              <header key={i} className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                  {b.data.title}
                </h1>
                {b.data.excerpt && (
                  <p className="mt-3 text-base text-muted-foreground leading-relaxed">
                    {b.data.excerpt}
                  </p>
                )}
              </header>
            );
          }
          case "heading": {
            const b = block as Extract<Block, { type: "heading" }>;
            if (b.level === 3) {
              return (
                <h3
                  key={i}
                  id={b.id}
                  className="scroll-mt-24 text-lg font-semibold text-foreground mt-8 mb-2"
                >
                  {b.text}
                </h3>
              );
            }
            return (
              <h2
                key={i}
                id={b.id}
                className="scroll-mt-24 text-xl sm:text-2xl font-bold text-foreground mt-10 mb-3"
              >
                {b.text}
              </h2>
            );
          }
          case "paragraph": {
            const b = block as Extract<Block, { type: "paragraph" }>;
            return (
              <p
                key={i}
                className="text-[15px] text-muted-foreground leading-7 my-4 whitespace-pre-line"
              >
                {b.text}
              </p>
            );
          }
          case "bullets": {
            const b = block as Extract<Block, { type: "bullets" }>;
            return (
              <ul key={i} className="my-4 space-y-2">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5 text-[15px] text-muted-foreground leading-7">
                    <CheckCircle2 className="w-4 h-4 mt-1.5 shrink-0 text-primary" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            );
          }
          case "numbered": {
            const b = block as Extract<Block, { type: "numbered" }>;
            return (
              <ol key={i} className="my-4 space-y-2 list-none">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5 text-[15px] text-muted-foreground leading-7">
                    <span className="flex h-5 w-5 mt-1 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                      {j + 1}
                    </span>
                    <span>{it}</span>
                  </li>
                ))}
              </ol>
            );
          }
          case "card":
            return <CardView key={i} block={block as CardBlock} />;
          case "callout":
            return <CalloutView key={i} block={block as CalloutBlock} />;
          case "faq":
            return <FaqView key={i} block={block as FaqBlock} />;
          case "cta":
            return <CtaView key={i} block={block as CtaBlock} />;
          case "product_grid_placeholder": {
            // Renders real, published LaptopFinder products selected from the
            // block's stored editorial intent. Never renders hallucinated data —
            // when nothing matches (or the feature is off) it stays hidden on the
            // public page and shows an explanatory note only in admin preview.
            const b = block as Extract<Block, { type: "product_grid_placeholder" }>;

            if (!productBlocksEnabled) {
              if (!adminPreview) return null;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 my-6 text-xs text-muted-foreground"
                >
                  <p className="font-medium text-foreground mb-1">Product cards placeholder</p>
                  <p>
                    Intent: {b.data?.filterIntent ?? "—"} · limit: {b.data?.limit ?? "—"}. Product
                    blocks are disabled by admin; hidden on the public page.
                  </p>
                </div>
              );
            }

            const picks = selectProductsForIntent(laptops, b.data?.filterIntent, b.data?.limit);
            if (picks.length === 0) {
              if (!adminPreview) return null;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 my-6 text-xs text-muted-foreground"
                >
                  <p className="font-medium text-foreground mb-1">Product cards placeholder</p>
                  <p>
                    Intent: {b.data?.filterIntent ?? "—"} · limit: {b.data?.limit ?? "—"}. No
                    published laptops to show yet — add laptops to populate this block.
                  </p>
                </div>
              );
            }

            return (
              <ProductGridView
                key={i}
                picks={picks}
                intent={b.data?.filterIntent}
                adminPreview={adminPreview}
              />
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}
