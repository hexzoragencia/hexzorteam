"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Lightbulb, Plus, Trash2, Pencil, ExternalLink, Copy, Save,
  Image as ImgIcon, MessageSquareQuote, Bot, Wrench, BookOpen, FileText, Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Recurso = {
  id: string; espacio_id: string;
  categoria: string; titulo: string;
  url: string | null; descripcion: string | null;
  created_at: string;
};

const CATEGORIAS = [
  { value: "creativos",     label: "Creativos",     icon: ImgIcon,           color: "bg-pink-500/15 text-pink-500" },
  { value: "hooks",         label: "Hooks",         icon: MessageSquareQuote, color: "bg-orange-500/15 text-orange-500" },
  { value: "gpts",          label: "GPTs",          icon: Bot,               color: "bg-purple-500/15 text-purple-500" },
  { value: "herramientas",  label: "Herramientas",  icon: Wrench,            color: "bg-blue-500/15 text-blue-500" },
  { value: "tutoriales",    label: "Tutoriales",    icon: BookOpen,          color: "bg-green-500/15 text-green-500" },
  { value: "plantillas",    label: "Plantillas",    icon: FileText,          color: "bg-amber-500/15 text-amber-500" },
  { value: "otros",         label: "Otros",         icon: Folder,            color: "bg-muted text-muted-foreground" },
];

const FORM_DEFAULT = { categoria: "herramientas", titulo: "", url: "", descripcion: "" };

export function RecursosClient({ espacioId, initial }: { espacioId: string; initial: Recurso[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [recursos, setRecursos] = useState<Recurso[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [filtroCat, setFiltroCat] = useState<string>("todos");

  const grupos = useMemo(() => {
    const g: Record<string, Recurso[]> = {};
    for (const r of recursos) (g[r.categoria] ??= []).push(r);
    return g;
  }, [recursos]);

  const filtradas = filtroCat === "todos" ? recursos : (grupos[filtroCat] ?? []);

  function abrirCrear() {
    setForm(FORM_DEFAULT); setEditing(null); setShowForm(true);
  }
  function abrirEditar(r: Recurso) {
    setForm({
      categoria: r.categoria, titulo: r.titulo,
      url: r.url ?? "", descripcion: r.descripcion ?? "",
    });
    setEditing(r.id);
    setShowForm(true);
  }
  function cancelar() {
    setShowForm(false); setEditing(null); setForm(FORM_DEFAULT);
  }

  async function guardar() {
    const titulo = form.titulo.trim();
    if (!titulo) { alert("Falta el título"); return; }
    let url = form.url.trim();
    if (url && !/^https?:\/\//.test(url)) url = "https://" + url;
    setSaving(true);
    const payload: any = {
      espacio_id: espacioId,
      categoria: form.categoria,
      titulo,
      url: url || null,
      descripcion: form.descripcion.trim() || null,
    };
    if (editing) {
      const { data, error } = await supabase.from("emp_recursos").update(payload).eq("id", editing).select().single();
      setSaving(false);
      if (error) { alert(error.message); return; }
      setRecursos(recursos.map(r => r.id === editing ? (data as Recurso) : r));
    } else {
      const { data, error } = await supabase.from("emp_recursos").insert(payload).select().single();
      setSaving(false);
      if (error) { alert(error.message); return; }
      setRecursos([data as Recurso, ...recursos]);
    }
    cancelar();
    router.refresh();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este recurso?")) return;
    const { error } = await supabase.from("emp_recursos").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setRecursos(recursos.filter(r => r.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="h-7 w-7 text-primary" /> Recursos
          </h1>
          <p className="text-muted-foreground text-sm">Tu biblioteca de creativos, hooks, GPTs y herramientas.</p>
        </div>
        <Button onClick={abrirCrear}><Plus className="h-4 w-4 mr-1" /> Nuevo recurso</Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editing ? "Editar recurso" : "Nuevo recurso"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Categoría</Label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. GPT para crear hooks de ventas" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>URL (opcional)</Label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Descripción (opcional)</Label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Cómo se usa, para qué sirve..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={guardar} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button variant="outline" onClick={cancelar}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros por categoría */}
      <div className="flex flex-wrap gap-2">
        <FiltroChip label="Todos" count={recursos.length} activo={filtroCat === "todos"} onClick={() => setFiltroCat("todos")} />
        {CATEGORIAS.filter(c => grupos[c.value]?.length).map(c => {
          const Icon = c.icon;
          return (
            <FiltroChip
              key={c.value}
              icon={<Icon className="h-3.5 w-3.5" />}
              label={c.label}
              count={grupos[c.value]?.length ?? 0}
              activo={filtroCat === c.value}
              onClick={() => setFiltroCat(c.value)}
            />
          );
        })}
      </div>

      {/* Listado */}
      {filtradas.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {recursos.length === 0 ? "Aún no tienes recursos guardados." : "No hay recursos en esta categoría."}
            </p>
            {recursos.length === 0 && (
              <Button onClick={abrirCrear} variant="outline"><Plus className="h-4 w-4 mr-1" /> Agregar el primero</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtradas.map(r => {
            const cat = CATEGORIAS.find(c => c.value === r.categoria);
            const Icon = cat?.icon ?? Folder;
            return (
              <Card key={r.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded font-semibold", cat?.color)}>
                      <Icon className="h-3 w-3" /> {cat?.label}
                    </span>
                    <div className="flex gap-0.5 -mr-1 -mt-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => abrirEditar(r)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => borrar(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-sm truncate">{r.titulo}</h3>
                  {r.descripcion && <p className="text-xs text-muted-foreground line-clamp-2">{r.descripcion}</p>}
                  {r.url && (
                    <div className="flex justify-end gap-1 pt-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => navigator.clipboard.writeText(r.url!).catch(() => {})}>
                        <Copy className="h-3 w-3 mr-1" /> Copiar
                      </Button>
                      <Button asChild size="sm" className="h-7 text-xs">
                        <a href={r.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                        </a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FiltroChip({ label, count, activo, onClick, icon }: {
  label: string; count: number; activo: boolean; onClick: () => void; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition",
        activo ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted text-muted-foreground"
      )}
    >
      {icon} {label}
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", activo ? "bg-primary/20" : "bg-muted")}>{count}</span>
    </button>
  );
}
