"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Plus, Trash2, ExternalLink, Copy, Save, Pencil, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

type Pagina = {
  id: string; espacio_id: string;
  pais: string;
  url: string | null;            // dominio principal (tutienda.com)
  url_meta_ads: string | null;   // URL biblioteca de anuncios Meta
  titulo: string | null;
  observacion: string | null;
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

const FORM_DEFAULT = { pais: "CO", url: "", url_meta_ads: "", titulo: "", observacion: "" };

export function PaginasClient({ espacioId, initial }: { espacioId: string; initial: Pagina[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [paginas, setPaginas] = useState<Pagina[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [filtroPais, setFiltroPais] = useState<string>("todos");

  const grupos = useMemo(() => {
    const g: Record<string, Pagina[]> = {};
    for (const p of paginas) (g[p.pais] ??= []).push(p);
    return g;
  }, [paginas]);

  const filtradas = filtroPais === "todos" ? paginas : (grupos[filtroPais] ?? []);

  function abrirCrear() {
    setForm(FORM_DEFAULT);
    setEditing(null);
    setShowForm(true);
  }

  function abrirEditar(p: Pagina) {
    setForm({
      pais: p.pais,
      url: p.url ?? "",
      url_meta_ads: p.url_meta_ads ?? "",
      titulo: p.titulo ?? "",
      observacion: p.observacion ?? "",
    });
    setEditing(p.id);
    setShowForm(true);
    // scroll al form
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  }

  function cancelar() {
    setShowForm(false);
    setEditing(null);
    setForm(FORM_DEFAULT);
  }

  function fixUrl(u: string): string | null {
    const t = u.trim();
    if (!t) return null;
    if (!/^https?:\/\//.test(t)) return "https://" + t;
    return t;
  }

  async function guardar() {
    const url = fixUrl(form.url);
    const urlMeta = fixUrl(form.url_meta_ads);
    if (!url && !urlMeta) {
      alert("Necesitas al menos una URL: dominio principal o biblioteca de anuncios Meta");
      return;
    }
    setSaving(true);
    const payload = {
      espacio_id: espacioId,
      pais: form.pais,
      url: url,
      url_meta_ads: urlMeta,
      titulo: form.titulo.trim() || null,
      observacion: form.observacion.trim() || null,
    };
    if (editing) {
      const { data, error } = await supabase.from("emp_paginas").update(payload).eq("id", editing).select().single();
      setSaving(false);
      if (error) { alert(error.message); return; }
      setPaginas(paginas.map(p => p.id === editing ? (data as Pagina) : p));
    } else {
      const { data, error } = await supabase.from("emp_paginas").insert(payload).select().single();
      setSaving(false);
      if (error) { alert(error.message); return; }
      setPaginas([data as Pagina, ...paginas]);
    }
    cancelar();
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
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-7 w-7 text-primary" /> Páginas Ganadoras
          </h1>
          <p className="text-muted-foreground text-sm">Landings de referencia organizadas por país. Cada una con dominio + biblioteca de anuncios Meta.</p>
        </div>
        <Button onClick={abrirCrear}><Plus className="h-4 w-4 mr-1" /> Agregar página</Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editing ? "Editar página" : "Nueva página"}
            </CardTitle>
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
                <Label>Título / nombre (opcional)</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Tienda Valkyria" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-primary" /> URL del dominio principal
                </Label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="tiendavalkyria.com"
                />
                <p className="text-[11px] text-muted-foreground">La URL de la tienda/landing tal cual se ve para el cliente.</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="flex items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5 text-blue-500" /> URL biblioteca de anuncios Meta
                </Label>
                <Input
                  value={form.url_meta_ads}
                  onChange={(e) => setForm({ ...form, url_meta_ads: e.target.value })}
                  placeholder="https://www.facebook.com/ads/library/?..."
                />
                <p className="text-[11px] text-muted-foreground">Link a sus anuncios activos en Meta Ads Library para espiar creativos.</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Observación (opcional)</Label>
                <Input value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} placeholder="Por qué es interesante, qué replicar..." />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Mínimo necesitas una de las dos URLs.</p>
            <div className="flex gap-2">
              <Button onClick={guardar} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button variant="outline" onClick={cancelar}>Cancelar</Button>
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
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs uppercase tracking-wide font-semibold inline-flex items-center gap-1">
                      {pais?.flag} {pais?.label}
                    </span>
                    <div className="flex gap-0.5 -mr-1 -mt-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => abrirEditar(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => borrar(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {p.titulo && <p className="font-semibold text-sm truncate">{p.titulo}</p>}

                  {/* URL dominio */}
                  {p.url && (
                    <UrlRow
                      icon={<Globe className="h-3 w-3" />}
                      label="Dominio"
                      url={p.url}
                      buttonLabel="Abrir tienda"
                      buttonColor="primary"
                      onCopy={() => copiar(p.url!)}
                    />
                  )}

                  {/* URL Meta Ads Library */}
                  {p.url_meta_ads && (
                    <UrlRow
                      icon={<Megaphone className="h-3 w-3" />}
                      label="Meta Ads"
                      url={p.url_meta_ads}
                      buttonLabel="Ver anuncios"
                      buttonColor="blue"
                      onCopy={() => copiar(p.url_meta_ads!)}
                    />
                  )}

                  {/* Si está vacío de URLs, indicar incompleto */}
                  {!p.url && !p.url_meta_ads && (
                    <p className="text-xs text-warning italic">Sin URLs — edita para agregar</p>
                  )}

                  {p.observacion && <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t">{p.observacion}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UrlRow({ icon, label, url, buttonLabel, buttonColor, onCopy }: {
  icon: React.ReactNode; label: string; url: string | null | undefined;
  buttonLabel: string; buttonColor: "primary" | "blue";
  onCopy: () => void;
}) {
  // Defensa: si url es vacío/null, no renderizar nada
  if (!url || typeof url !== "string") return null;
  const urlClean = url.replace(/^https?:\/\//, "");
  return (
    <div className="rounded-md border bg-muted/30 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
        {icon} {label}
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="text-xs hover:underline break-all line-clamp-1 mb-1.5 block">
        {urlClean}
      </a>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onCopy}
          className="h-6 text-[11px] px-2 flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-input bg-background hover:bg-accent transition"
        >
          <Copy className="h-3 w-3" /> Copiar
        </button>
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          className={cn(
            "h-6 text-[11px] px-2 flex-1 inline-flex items-center justify-center gap-1 rounded-md font-medium transition",
            buttonColor === "blue"
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-primary hover:bg-primary/90 text-primary-foreground",
          )}
        >
          <ExternalLink className="h-3 w-3" /> {buttonLabel}
        </a>
      </div>
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
