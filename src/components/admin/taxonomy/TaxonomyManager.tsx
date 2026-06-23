"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { DOMAIN_ORDER, type DomainId } from "@/lib/domains";

export interface CourseRow {
  id: string;
  domain: DomainId;
  category: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export function TaxonomyManager({ initial }: { initial: CourseRow[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<CourseRow[]>(initial);
  const [domain, setDomain] = useState<DomainId>("design");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Edit state for a single specialisation row
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editName, setEditName] = useState("");
  const [editSort, setEditSort] = useState<number>(0);

  // Add-new-programme form
  const [addCategory, setAddCategory] = useState("");
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);

  const domainRows = useMemo(
    () =>
      rows
        .filter((r) => r.domain === domain)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [rows, domain]
  );

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const r of domainRows) if (!seen.includes(r.category)) seen.push(r.category);
    return seen;
  }, [domainRows]);

  async function refresh() {
    const { data } = await supabase
      .from("courses")
      .select("id, domain, category, name, sort_order, is_active")
      .order("sort_order", { ascending: true });
    if (data) setRows(data as CourseRow[]);
  }

  async function handleAdd() {
    setError(null);
    const category = addCategory.trim();
    const name = addName.trim();
    if (!category || !name) {
      setError("Both programme and specialisation are required.");
      return;
    }
    setAdding(true);
    // Place new row after the highest sort_order in this domain.
    const maxSort = domainRows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const { error: err } = await supabase
      .from("courses")
      .insert({ domain, category, name, sort_order: maxSort + 1 });
    setAdding(false);
    if (err) {
      setError(err.message);
      return;
    }
    setAddCategory("");
    setAddName("");
    await refresh();
  }

  function startEdit(row: CourseRow) {
    setEditingId(row.id);
    setEditCategory(row.category);
    setEditName(row.name);
    setEditSort(row.sort_order);
    setError(null);
  }

  async function saveEdit(id: string) {
    setError(null);
    const category = editCategory.trim();
    const name = editName.trim();
    if (!category || !name) {
      setError("Programme and specialisation cannot be empty.");
      return;
    }
    setBusyId(id);
    const { error: err } = await supabase
      .from("courses")
      .update({ category, name, sort_order: editSort })
      .eq("id", id);
    setBusyId(null);
    if (err) {
      setError(err.message);
      return;
    }
    setEditingId(null);
    await refresh();
  }

  async function toggleActive(row: CourseRow, value: boolean) {
    setBusyId(row.id);
    const { error: err } = await supabase
      .from("courses")
      .update({ is_active: value })
      .eq("id", row.id);
    setBusyId(null);
    if (err) {
      setError(err.message);
      return;
    }
    await refresh();
  }

  async function handleDelete(row: CourseRow) {
    if (
      !confirm(
        `Permanently delete "${row.name}"? Laptops already tagged with it keep the text tag. Use the toggle to hide it instead.`
      )
    )
      return;
    setBusyId(row.id);
    const { error: err } = await supabase.from("courses").delete().eq("id", row.id);
    setBusyId(null);
    if (err) {
      setError(err.message);
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-5">
      {/* Domain selector */}
      <div className="flex flex-wrap gap-2">
        {DOMAIN_ORDER.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => {
              setDomain(d.id);
              setEditingId(null);
              setError(null);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              domain === d.id
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/60 text-muted-foreground hover:border-border"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>
      )}

      {/* Programmes grouped by category */}
      <div className="glass-card rounded-xl border divide-y divide-border/20">
        {categories.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No programmes yet for {DOMAIN_ORDER.find((d) => d.id === domain)?.label}. Add one below.
          </p>
        )}
        {categories.map((cat) => (
          <div key={cat} className="px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
              {cat}
            </p>
            <div className="space-y-1.5">
              {domainRows
                .filter((r) => r.category === cat)
                .map((row) =>
                  editingId === row.id ? (
                    <div key={row.id} className="flex flex-wrap items-center gap-2 py-1">
                      <Input
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="Programme"
                        className="h-8 w-44 bg-background/50 text-xs"
                      />
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Specialisation"
                        className="h-8 w-52 bg-background/50 text-xs"
                      />
                      <Input
                        type="number"
                        value={editSort}
                        onChange={(e) => setEditSort(Number(e.target.value))}
                        className="h-8 w-16 bg-background/50 text-xs"
                        title="Sort order"
                      />
                      <Button
                        size="sm"
                        onClick={() => saveEdit(row.id)}
                        disabled={busyId === row.id}
                        className="h-8 gap-1 bg-primary text-primary-foreground"
                      >
                        {busyId === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 gap-1">
                        <X className="w-3 h-3" /> Cancel
                      </Button>
                    </div>
                  ) : (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 py-1"
                    >
                      <span
                        className={`text-sm ${row.is_active ? "text-foreground" : "text-muted-foreground/50 line-through"}`}
                      >
                        {row.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={row.is_active}
                          onCheckedChange={(v: boolean) => toggleActive(row, v)}
                          title={row.is_active ? "Visible — toggle to hide" : "Hidden — toggle to show"}
                        />
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="text-muted-foreground hover:text-foreground p-1"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          className="text-muted-foreground hover:text-destructive p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                )}
            </div>
          </div>
        ))}
      </div>

      {/* Add new programme/specialisation */}
      <div className="glass-card rounded-xl border p-5 space-y-3">
        <p className="text-sm font-medium text-foreground">Add a programme</p>
        <p className="text-xs text-muted-foreground -mt-1">
          Type an existing programme name to add a specialisation to it, or a new name to create a group.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            list="taxonomy-categories"
            value={addCategory}
            onChange={(e) => setAddCategory(e.target.value)}
            placeholder="Programme (e.g. Data & AI)"
            className="h-9 w-56 bg-background/50 text-sm"
          />
          <datalist id="taxonomy-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Specialisation (e.g. Data Science)"
            className="h-9 w-64 bg-background/50 text-sm"
          />
          <Button onClick={handleAdd} disabled={adding} className="h-9 gap-1.5 bg-primary text-primary-foreground">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
