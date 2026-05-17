"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Globe, Plus, Trash2, ExternalLink, Copy, Save, Pencil, Megaphone,
  Search, X as Close, Sparkles, Check, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Pagina = {
  id: string; espacio_id: string;
  pais: string;
  url: string | null;            // dominio principal
  url_meta_ads: string | null;   // biblioteca de anuncios Meta
  titulo: string | null;
  observacion: string | null;
  created_at: string;
};

const PAISES = [
  { value: "CO",         label: "Colombia",           flag: "🇨🇴" },
  { value: "MX",         label: "México",             flag: "🇲🇽" },
  { value: "EC",         label: "Ecuador",            flag: "🇪🇨" },
  { value: "PE",         label: "Perú",               flag: "🇵🇪" },
  { value: "GT",         label: "Guatemala",          flag: "🇬🇹" },
  { value: "ES",         label: "España",             flag: "🇪🇸" },
  { value: "CL",         label: "Chile",              flag: "🇨🇱" },
  { value: "USA",        label: "USA",                flag: "🇺🇸" },
  { value: "VARIAS",     label: "Multi-país",         flag: "🌍" },
  { value: "CONOCIDAS",  label: "Personas conocidas", flag: "👥" },
  { value: "OTRO",       label: "Otro",               flag: "🌐" },
];

const FORM_DEFAULT = { pais: "CO", url: "", url_meta_ads: "", titulo: "", observacion: "" };

function paisMeta(v: string) {
  return PAISES.find(p => p.value === v) ?? PAISES[PAISES.length - 1];
}

// Códigos de país que entiende Meta Ads Library (ISO-2). El resto → ALL.
const META_PAIS: Record<string, string> = {
  CO: "CO", MX: "MX", EC: "EC", PE: "PE", GT: "GT", ES: "ES", CL: "CL", USA: "US",
};

// Genera el link de BÚSQUEDA en la biblioteca de anuncios de Meta a partir
// del dominio o el título, para encontrar sus anuncios directamente aunque
// no se haya guardado el link explícito.
function buscarEnMetaAds(p: { url: string | null; titulo: string | null; pais: string }): string | null {
  // Término: el dominio sin protocolo/www/TLD, o el título
  let termino = "";
  if (p.url) {
    termino = p.url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .replace(/\.(com|net|co|shop|store|io|mx|es|cl|pe)(\.[a-z]{2})?$/i, "")
      .replace(/[-_.]/g, " ")
      .trim();
  }
  if (!termino && p.titulo) termino = p.titulo.trim();
  if (!termino) return null;
  const country = META_PAIS[p.pais] ?? "ALL";
  const q = encodeURIComponent(termino);
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${q}&search_type=keyword_unordered&media_type=all`;
}

export function PaginasClient({ espacioId, initial }: { espacioId: string; initial: Pagina[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [paginas, setPaginas] = useState<Pagina[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [filtroPais, setFiltroPais] = useState<string>("todos");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [limpiando, setLimpiando] = useState(false);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  }

  // Conteos por país
  const conteos = useMemo(() => {
    const c: Record<string, number> = { todos: paginas.length };
    for (const p of paginas) c[p.pais] = (c[p.pais] ?? 0) + 1;
    return c;
  }, [paginas]);

  // Cuántas no tienen NINGÚN link
  const sinLink = useMemo(
    () => paginas.filter(p => !p.url?.trim() && !p.url_meta_ads?.trim()),
    [paginas]
  );

  // Filtrado + búsqueda
  const filtradas = useMemo(() => {
    let lista = filtroPais === "todos" ? paginas : paginas.filter(p => p.pais === filtroPais);
    const q = query.trim().toLowerCase();
    if (q) {
      lista = lista.filter(p =>
        (p.titulo ?? "").toLowerCase().includes(q) ||
        (p.url ?? "").toLowerCase().includes(q) ||
        (p.url_meta_ads ?? "").toLowerCase().includes(q) ||
        (p.observacion ?? "").toLowerCase().includes(q)
      );
    }
    return lista;
  }, [paginas, filtroPais, query]);

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
      showToast("Necesitas al menos una URL (dominio o Meta Ads)");
      return;
    }
    setSaving(true);
    const payload = {
      espacio_id: espacioId,
      pais: form.pais,
      url,
      url_meta_ads: urlMeta,
      titulo: form.titulo.trim() || null,
      observacion: form.observacion.trim() || null,
    };
    if (editing) {
      const { data, error } = await supabase.from("emp_paginas").update(payload).eq("id", editing).select().single();
      setSaving(false);
      if (error) { showToast(error.message); return; }
      setPaginas(paginas.map(p => p.id === editing ? (data as Pagina) : p));
      showToast("Actualizada");
    } else {
      const { data, error } = await supabase.from("emp_paginas").insert(payload).select().single();
      setSaving(false);
      if (error) { showToast(error.message); return; }
      setPaginas([data as Pagina, ...paginas]);
      showToast("Agregada");
    }
    cancelar();
    router.refresh();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar esta página?")) return;
    const { error } = await supabase.from("emp_paginas").delete().eq("id", id);
    if (error) { showToast(error.message); return; }
    setPaginas(paginas.filter(p => p.id !== id));
    showToast("Eliminada");
  }

  async function limpiarSinLink() {
    if (sinLink.length === 0) return;
    if (!confirm(`Se borrarán ${sinLink.length} páginas que NO tienen ningún link. ¿Continuar?`)) return;
    setLimpiando(true);
    const ids = sinLink.map(p => p.id);
    const { error } = await supabase.from("emp_paginas").delete().in("id", ids);
    setLimpiando(false);
    if (error) { showToast(error.message); return; }
    setPaginas(paginas.filter(p => !ids.includes(p.id)));
    showToast(`${ids.length} páginas sin link eliminadas`);
    router.refresh();
  }

  async function copiar(url: string) {
    try { await navigator.clipboard.writeText(url); showToast("Link copiado"); } catch { /* ignore */ }
  }

  const paisesConPaginas = PAISES.filter(p => conteos[p.value]);

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md"></div>
            <Globe className="h-5 w-5 text-primary relative" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Páginas Ganadoras</h1>
            <p className="text-xs text-muted-foreground">
              {paginas.length} {paginas.length === 1 ? "página" : "páginas"} de referencia · espía landings y creativos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sinLink.length > 0 && (
            <button
              onClick={limpiarSinLink}
              disabled={limpiando}
              className="h-9 px-3 rounded-lg border border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400 text-sm font-medium hover:bg-rose-500/10 transition flex items-center gap-1.5"
              title="Borrar las páginas que no tienen ningún link"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {limpiando ? "Limpiando…" : `Limpiar ${sinLink.length} sin link`}
            </button>
          )}
          <Button onClick={abrirCrear} className="shadow-md shadow-primary/20">
            <Plus className="h-4 w-4 mr-1" /> Agregar página
          </Button>
        </div>
      </div>

      {/* BUSCADOR */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, dominio o nota…"
          className="pl-10 h-11"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground">
            <Close className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* FORM */}
      {showForm && (
        <div className="rounded-xl border border-primary/30 bg-card shadow-lg shadow-primary/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              {editing ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
              <h3 className="font-semibold text-sm">{editing ? "Editar página" : "Nueva página ganadora"}</h3>
            </div>
            <button onClick={cancelar} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
              <Close className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">País *</Label>
                <select
                  value={form.pais}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {PAISES.map(p => <option key={p.value} value={p.value}>{p.flag} {p.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nombre / título</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Tienda Valkyria" className="h-10" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-primary" /> URL del dominio (la tienda)
                </Label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="tiendavalkyria.com" className="h-10" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5 text-blue-500" /> URL Meta Ads Library (sus anuncios)
                </Label>
                <Input value={form.url_meta_ads} onChange={(e) => setForm({ ...form, url_meta_ads: e.target.value })} placeholder="https://www.facebook.com/ads/library/?..." className="h-10" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Nota (por qué es interesante)</Label>
                <Input value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} placeholder="Ángulo, oferta, qué replicar…" className="h-10" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Mínimo necesitas una de las dos URLs.</p>
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 bg-muted/30 border-t">
            <Button variant="outline" onClick={cancelar}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving} className="shadow-md shadow-primary/20">
              <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando…" : (editing ? "Guardar" : "Agregar")}
            </Button>
          </div>
        </div>
      )}

      {/* CONTENIDO: sidebar países + grid */}
      <div className="grid lg:grid-cols-[190px_1fr] gap-5">
        {/* Sidebar países */}
        <aside className="space-y-1 lg:sticky lg:top-4 lg:self-start">
          <SidebarItem label="Todos los países" flag={<Filter className="h-3.5 w-3.5" />} count={conteos.todos ?? 0} active={filtroPais === "todos"} onClick={() => setFiltroPais("todos")} />
          <div className="h-px bg-border my-2"></div>
          {paisesConPaginas.map(p => (
            <SidebarItem
              key={p.value}
              label={p.label}
              flag={<span className="text-base">{p.flag}</span>}
              count={conteos[p.value] ?? 0}
              active={filtroPais === p.value}
              onClick={() => setFiltroPais(p.value)}
            />
          ))}
        </aside>

        {/* Grid de páginas */}
        <div className="min-w-0">
          {filtradas.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-card/40 py-16 text-center space-y-3">
              <Globe className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium">{paginas.length === 0 ? "Aún no tienes páginas" : "Sin resultados"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {paginas.length === 0 ? "Agrega tu primera página ganadora" : query ? "Prueba otra búsqueda" : "No hay páginas en este país"}
                </p>
              </div>
              {paginas.length === 0 && (
                <Button onClick={abrirCrear} variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Agregar la primera</Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtradas.map(p => {
                const meta = paisMeta(p.pais);
                return (
                  <div key={p.id} className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
                    <div className="p-4 space-y-3">
                      {/* Cabecera */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <span className="text-sm">{meta.flag}</span> {meta.label}
                          </div>
                          <h3 className="font-semibold text-[15px] leading-tight truncate mt-0.5">
                            {p.titulo || p.url?.replace(/^https?:\/\//, "") || "Página sin nombre"}
                          </h3>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => abrirEditar(p)} title="Editar" className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => borrar(p.id)} title="Borrar" className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Botones de acción grandes */}
                      <div className="space-y-2">
                        {p.url && (
                          <LinkAccion
                            href={p.url}
                            icon={<Globe className="h-3.5 w-3.5" />}
                            label="Abrir tienda"
                            sub={p.url.replace(/^https?:\/\//, "")}
                            color="primary"
                            onCopy={() => copiar(p.url!)}
                          />
                        )}
                        {p.url_meta_ads ? (
                          <LinkAccion
                            href={p.url_meta_ads}
                            icon={<Megaphone className="h-3.5 w-3.5" />}
                            label="Ver anuncios Meta"
                            sub="Espiar creativos activos"
                            color="blue"
                            onCopy={() => copiar(p.url_meta_ads!)}
                          />
                        ) : (
                          (() => {
                            const buscarUrl = buscarEnMetaAds(p);
                            return buscarUrl ? (
                              <LinkAccion
                                href={buscarUrl}
                                icon={<Megaphone className="h-3.5 w-3.5" />}
                                label="Buscar en Meta Ads"
                                sub="Anuncios de este dominio"
                                color="blue"
                                onCopy={() => copiar(buscarUrl)}
                              />
                            ) : null;
                          })()
                        )}
                      </div>

                      {p.observacion && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 pt-2 border-t border-border/50">
                          {p.observacion}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium shadow-2xl flex items-center gap-2 z-50">
          <Check className="h-4 w-4" /> {toast}
        </div>
      )}
    </div>
  );
}

function SidebarItem({ label, flag, count, active, onClick }: {
  label: string; flag: React.ReactNode; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition",
        active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className="shrink-0">{flag}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {count > 0 && (
        <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
          {count}
        </span>
      )}
    </button>
  );
}

function LinkAccion({ href, icon, label, sub, color, onCopy }: {
  href: string; icon: React.ReactNode; label: string; sub: string;
  color: "primary" | "blue"; onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex-1 min-w-0 rounded-lg px-3 py-2 flex items-center gap-2.5 transition group/btn",
          color === "blue"
            ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20"
            : "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold leading-tight">{label}</span>
          <span className="block text-[10px] opacity-70 truncate">{sub}</span>
        </span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
      </a>
      <button
        onClick={onCopy}
        title="Copiar link"
        className="h-9 w-9 shrink-0 rounded-lg border border-input bg-background hover:bg-muted flex items-center justify-center text-muted-foreground transition"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
