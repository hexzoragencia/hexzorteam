"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Plus, Trash2, ExternalLink, Copy, Save, X as Close } from "lucide-react";
import { cn } from "@/lib/utils";

type Pagina = {
  id: string; espacio_id: string;
  pais: string; url: string; titulo: string | null; observacion: string | null;
  created_at: string;
};

const PAISES = [
  { value: "CO",         label: "Colombia",          flag: "🇨🇴" },
  { value: "MX",         label: "México",            flag: "🇲🇽" },
  { value: "EC",         label: "Ecuador",           flag: "🇪🇨" },
  { value: "PE",         label: "Perú",              flag: "🇵🇪" },
  { value: "GT",         label: "Guatemala",         flag: "🇬🇹" },
  { value: "ES",         label: "España",            flag: "🇪🇸" },
  { value: "CL",         label: "Chile",             flag: "🇨🇱" },
  { value: "USA",        label: "USA",               flag: "🇺🇸" },
  { value: "VARIAS",     label: "Multi-país",        flag: "🌍" },
  { value: "CONOCIDAS",  label: "Personas conocidas", flag: "👥" },
  { value: "OTRO",       label: "Otro",              flag: "🌐" },
];

const FORM_DEFAULT = { pais: "CO", url: "", titulo: "", observacion: "" };

export function PaginasClient({ espacioId, initial }: { espacioId: string; initial: Pagina[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [paginas, setPaginas] = useState<Pagina[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [filtroPais, setFiltroPais] = useState<string>("todos");

  const grupos = useMemo(() => {
    const g: Record<string, Pagina[]> = {};
    for (const p of paginas) (g[p.pais] ??= []).push(p);
    return g;
  }, [paginas]);

  const filtradas = filtroPais === "todos" ? paginas : (grupos[filtroPais] ?? []);

  async function guardar() {
    const url = form.url.trim();
    if (!url) { alert("Falta el URL"); return; }
    if (!/^https?:\/\//.test(url)) {
      // intentar arreglar el URL
      form.url = "https://" + url;
    }
    setSaving(true);
    const { data, error } = await supabase.from("emp_paginas").insert({
      espacio_id: espacioId,
      pais: form.pais,
      url: form.url,
      titulo: form.titulo || null,
      observacion: form.observacion || null,
    }).select().single();
    setSaving(false);
    if (error) { alert(error.message); return; }
    setPaginas([data as Pagina, ...paginas]);
    setForm(FORM_DEFAULT);
    setShowForm(false);
    router.refresh();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este link?")) return;
    const { error } = await supabase.from("emp_paginas").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setPaginas(paginas.filter(p => p.id !== id));
    router.refresh();
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-7 w-7 text-primary" /> Páginas Ganadoras
          </h1>
          <p className="text-muted-foreground text-sm">Landings de referencia organizadas por país.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Agregar página
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva página</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>País *</Label>
                <select
                  value={form.pais}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {PAISES.map(p => <option key={p.value} value={p.value}>{p.flag} {p.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Título (opcional)</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Tienda Valkyria - vela aromaterapia" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>URL *</Label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://tiendavalkyria.com" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Observación (opcional)</Label>
                <Input value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} placeholder="Por qué es interesante, qué replicar..." />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={guardar} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setForm(FORM_DEFAULT); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros por país */}
      <div className="flex flex-wrap gap-2">
        <FiltroChip label="Todos" count={paginas.length} activo={filtroPais === "todos"} onClick={() => setFiltroPais("todos")} />
        {PAISES.filter(p => grupos[p.value]?.length).map(p => (
          <FiltroChip
            key={p.value}
            label={`${p.flag} ${p.label}`}
            count={grupos[p.value]?.length ?? 0}
            activo={filtroPais === p.value}
            onClick={() => setFiltroPais(p.value)}
          />
        ))}
      </div>

      {/* Listado */}
      {filtradas.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <Globe className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {paginas.length === 0 ? "Aún no tienes páginas guardadas. Agrega la primera." : "No hay páginas en este país."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtradas.map(p => {
            const pais = PAISES.find(c => c.value === p.pais);
            return (
              <Card key={p.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs uppercase tracking-wide font-semibold inline-flex items-center gap-1">
                      {pais?.flag} {pais?.label}
                    </span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-destructive" onClick={() => borrar(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {p.titulo && <p className="font-semibold text-sm mb-1 truncate">{p.titulo}</p>}
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-primary hover:underline break-all flex items-center gap-1">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{p.url.replace(/^https?:\/\//, "")}</span>
                  </a>
                  {p.observacion && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.observacion}</p>}
                  <div className="flex justify-end gap-1 mt-3">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copiar(p.url)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                    <Button asChild size="sm" className="h-7 text-xs">
                      <a href={p.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FiltroChip({ label, count, activo, onClick }: { label: string; count: number; activo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition",
        activo ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted text-muted-foreground"
      )}
    >
      {label}
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", activo ? "bg-primary/20" : "bg-muted")}>{count}</span>
    </button>
  );
}
