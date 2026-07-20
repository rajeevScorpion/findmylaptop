"use client";

import { useState, useRef, useEffect } from "react";

interface InlinePriceEditProps {
  laptopId: string;
  initialPrice: number | null;
  initialLabel: string | null;
}

function formatPriceLabel(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function InlinePriceEdit({ laptopId, initialPrice, initialLabel }: InlinePriceEditProps) {
  const [price, setPrice] = useState<number | null>(initialPrice);
  const [label, setLabel] = useState<string | null>(initialLabel);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEditing() {
    setDraft(price != null ? String(price) : "");
    setEditing(true);
  }

  async function save() {
    const cleaned = draft.replace(/\D/g, ""); // digits only — strips ₹, commas, spaces
    const next = cleaned === "" ? null : Number(cleaned);

    // Nothing entered, or unchanged → just close the editor
    if (next === null || next === price) {
      setEditing(false);
      return;
    }

    const nextLabel = formatPriceLabel(next);
    const prevPrice = price;
    const prevLabel = label;

    // optimistic
    setPrice(next);
    setLabel(nextLabel);
    setEditing(false);
    setSaving(true);

    try {
      const response = await fetch("/api/admin/laptops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_price", laptopId, value: next }),
      });
      if (!response.ok) {
        setPrice(prevPrice);
        setLabel(prevLabel);
      }
    } catch {
      setPrice(prevPrice);
      setLabel(prevLabel);
    } finally {
      setSaving(false);
    }
  }

  function handleBlur() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditing(false);
      return;
    }
    save();
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            inputRef.current?.blur();
          } else if (e.key === "Escape") {
            cancelledRef.current = true;
            inputRef.current?.blur();
          }
        }}
        placeholder="157990"
        className="w-24 h-7 px-2 text-sm rounded-md border border-primary/40 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  return (
    <button
      onClick={startEditing}
      disabled={saving}
      title="Click to edit price"
      className="text-sm text-foreground hover:text-primary hover:underline decoration-dotted underline-offset-2 transition-colors disabled:opacity-50"
    >
      {label ?? (price != null ? formatPriceLabel(price) : "—")}
    </button>
  );
}
