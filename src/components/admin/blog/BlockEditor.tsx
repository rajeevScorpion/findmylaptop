"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Block } from "@/lib/blog/types";

type BlockType = Block["type"];

const ADDABLE: { type: BlockType; label: string; productOnly?: boolean }[] = [
  { type: "heading", label: "Heading" },
  { type: "paragraph", label: "Paragraph" },
  { type: "bullets", label: "Bullet list" },
  { type: "numbered", label: "Numbered list" },
  { type: "card", label: "Card" },
  { type: "callout", label: "Callout (info/tip/warning)" },
  { type: "faq", label: "FAQ" },
  { type: "cta", label: "CTA" },
  { type: "product_grid_placeholder", label: "Product cards placeholder", productOnly: true },
];

function emptyBlock(type: BlockType): Block {
  switch (type) {
    case "hero":
      return { type: "hero", data: { title: "", excerpt: "" } };
    case "heading":
      return { type: "heading", level: 2, text: "", id: "" };
    case "paragraph":
      return { type: "paragraph", text: "" };
    case "bullets":
      return { type: "bullets", items: [""] };
    case "numbered":
      return { type: "numbered", items: [""] };
    case "card":
      return { type: "card", title: "", content: "", icon: "" };
    case "callout":
      return { type: "callout", variant: "info", title: "", content: "" };
    case "faq":
      return { type: "faq", items: [{ question: "", answer: "" }] };
    case "cta":
      return { type: "cta", variant: "finder", title: "", body: "", href: "/", label: "" };
    case "product_grid_placeholder":
      return { type: "product_grid_placeholder", data: { filterIntent: "", limit: 4 } };
  }
}

const labelCls = "text-xs text-muted-foreground";
const inputCls = "bg-background/50";

interface BlockEditorProps {
  value: Block[];
  onChange: (blocks: Block[]) => void;
  productBlocksEnabled: boolean;
}

export function BlockEditor({ value, onChange, productBlocksEnabled }: BlockEditorProps) {
  const [adding, setAdding] = useState(false);

  const update = (i: number, next: Block) => {
    const copy = value.slice();
    copy[i] = next;
    onChange(copy);
  };
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const copy = value.slice();
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  const add = (type: BlockType) => {
    onChange([...value, emptyBlock(type)]);
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No content blocks yet. Use the AI panel above or add blocks manually.
        </p>
      )}

      {value.map((block, i) => (
        <div key={i} className="glass-card rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {block.type.replace(/_/g, " ")}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Move up">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Move down">
                <ChevronDown className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => remove(i)} className="p-1 text-destructive/80 hover:text-destructive" aria-label="Delete block">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <BlockFields block={block} onChange={(b) => update(i, b)} />
        </div>
      ))}

      {adding ? (
        <div className="glass-card rounded-xl border p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ADDABLE.filter((a) => productBlocksEnabled || !a.productOnly).map((a) => (
            <button
              key={a.type}
              type="button"
              onClick={() => add(a.type)}
              className="text-xs rounded-lg border border-border/60 px-2.5 py-2 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-xs rounded-lg px-2.5 py-2 text-muted-foreground hover:text-foreground col-span-full"
          >
            Cancel
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add block
        </Button>
      )}
    </div>
  );
}

function BlockFields({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-2">
          <Input className={inputCls} placeholder="Hero title" value={block.data.title}
            onChange={(e) => onChange({ ...block, data: { ...block.data, title: e.target.value } })} />
          <Textarea className={inputCls} rows={2} placeholder="Hero excerpt" value={block.data.excerpt ?? ""}
            onChange={(e) => onChange({ ...block, data: { ...block.data, excerpt: e.target.value } })} />
        </div>
      );
    case "heading":
      return (
        <div className="flex gap-2">
          <select
            className="bg-background/50 border border-input rounded-md text-sm px-2"
            value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) === 3 ? 3 : 2 })}
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <Input className={inputCls} placeholder="Heading text" value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })} />
        </div>
      );
    case "paragraph":
      return (
        <Textarea className={inputCls} rows={4} placeholder="Paragraph text" value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })} />
      );
    case "bullets":
    case "numbered":
      return (
        <div className="space-y-1">
          <Label className={labelCls}>One item per line</Label>
          <Textarea className={inputCls} rows={4} value={block.items.join("\n")}
            onChange={(e) => onChange({ ...block, items: e.target.value.split("\n") })} />
        </div>
      );
    case "card":
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input className={`${inputCls} max-w-[140px]`} placeholder="Icon (e.g. Laptop)" value={block.icon ?? ""}
              onChange={(e) => onChange({ ...block, icon: e.target.value })} />
            <Input className={inputCls} placeholder="Card title" value={block.title ?? ""}
              onChange={(e) => onChange({ ...block, title: e.target.value })} />
          </div>
          <Textarea className={inputCls} rows={3} placeholder="Card content" value={block.content}
            onChange={(e) => onChange({ ...block, content: e.target.value })} />
        </div>
      );
    case "callout":
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select className="bg-background/50 border border-input rounded-md text-sm px-2"
              value={block.variant}
              onChange={(e) => onChange({ ...block, variant: e.target.value as "info" | "warning" | "tip" })}>
              <option value="info">Info</option>
              <option value="tip">Tip</option>
              <option value="warning">Warning</option>
            </select>
            <Input className={inputCls} placeholder="Title (optional)" value={block.title ?? ""}
              onChange={(e) => onChange({ ...block, title: e.target.value })} />
          </div>
          <Textarea className={inputCls} rows={3} placeholder="Callout content" value={block.content}
            onChange={(e) => onChange({ ...block, content: e.target.value })} />
        </div>
      );
    case "faq":
      return (
        <div className="space-y-2">
          {block.items.map((item, k) => (
            <div key={k} className="space-y-1 rounded-lg border border-border/50 p-2">
              <div className="flex gap-2">
                <Input className={inputCls} placeholder="Question" value={item.question}
                  onChange={(e) => {
                    const items = block.items.slice();
                    items[k] = { ...items[k], question: e.target.value };
                    onChange({ ...block, items });
                  }} />
                <button type="button" className="text-destructive/80 hover:text-destructive px-1"
                  onClick={() => onChange({ ...block, items: block.items.filter((_, x) => x !== k) })}
                  aria-label="Remove FAQ">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <Textarea className={inputCls} rows={2} placeholder="Answer" value={item.answer}
                onChange={(e) => {
                  const items = block.items.slice();
                  items[k] = { ...items[k], answer: e.target.value };
                  onChange({ ...block, items });
                }} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="gap-1"
            onClick={() => onChange({ ...block, items: [...block.items, { question: "", answer: "" }] })}>
            <Plus className="w-3.5 h-3.5" /> Add question
          </Button>
        </div>
      );
    case "cta":
      return (
        <div className="space-y-2">
          <Input className={inputCls} placeholder="CTA title" value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })} />
          <Textarea className={inputCls} rows={2} placeholder="CTA body" value={block.body ?? ""}
            onChange={(e) => onChange({ ...block, body: e.target.value })} />
          <div className="flex gap-2">
            <Input className={inputCls} placeholder="Link (e.g. /)" value={block.href}
              onChange={(e) => onChange({ ...block, href: e.target.value })} />
            <Input className={inputCls} placeholder="Button label" value={block.label ?? ""}
              onChange={(e) => onChange({ ...block, label: e.target.value })} />
          </div>
        </div>
      );
    case "product_grid_placeholder":
      return (
        <div className="flex gap-2">
          <Input className={inputCls} placeholder="Filter intent (e.g. coding_under_60000)"
            value={block.data.filterIntent ?? ""}
            onChange={(e) => onChange({ ...block, data: { ...block.data, filterIntent: e.target.value } })} />
          <Input className={`${inputCls} max-w-[90px]`} type="number" placeholder="Limit"
            value={block.data.limit ?? 4}
            onChange={(e) => onChange({ ...block, data: { ...block.data, limit: Number(e.target.value) } })} />
        </div>
      );
    default:
      return null;
  }
}
