"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  KeyRound, Plus, Trash2, Pencil, Eye, EyeOff, Copy, Save, ExternalLink,
  Search, Star, Lock, Settings, X, Check, ShoppingBag, Music2, Facebook,
  Instagram, Globe, Mail, Building2, Bot, Truck, Wallet, ChevronRight,
} from "lucide-react";

type Acceso = {
  id: string;
  espacio_id: string;
  categoria: string | null;
  plataforma: string;
  etiqueta: string;
  persona: string | null;
  usuario: string | null;
  url: string | null;
  notas: string | null;
  favorito: boolean;
  updated_at: string;
};

const CATEGORIAS: { value: string; label: string; icon: any; color: string }[] = [
  { value: "shopify",   label: "Shopify",    icon: ShoppingBag,  color: "text-emerald-500" },
  { value: "tiktok",    label: "TikTok",     icon: Music2,       color: "text-pink-500" },
  { value: "meta",      label: "Meta",       icon: Facebook,     color: "text-blue-500" },
  { value: "instagram", label: "Instagram",  icon: Instagram,    color: "text-fuchsia-500" },
  { value: "correo",    label: "Correos",    icon: Mail,         color: "text-amber-500" },
  { value: "dominio",   label: "Dominios",   icon: Globe,        color: "text-cyan-500" },
  { value: "ia",        label: "IA",         icon: Bot,          color: "text-violet-500" },
  { value: "finanzas",  label: "Finanzas",   icon: Wallet,       color: "text-green-500" },
  { value: "logistica", label: "Logística",  icon: Truck,        color: "text-orange-500" },
  { value: "apps",      label: "Apps",       icon: Building2,    color: "text-sky-500" },
  { value: "otro",      label: "Otros",      icon: KeyRound,     color: "text-slate-400" },
];

function catMeta(cat: string | null) {
  return CATEGORIAS.find(c => c.value === cat) ?? CATEGORIAS[CATEGORIAS.length - 1];
}

const FORM_DEFAULT = {
  categoria: "shopify",
  etiqueta: "",
  persona: "",
  usuario: "",
  password: "",
  url: "",
  notas: "",
  favorito: false,
};

export function AccesosClient({ espacioId, slug, initial, esOwner }: {
  espacioId: string; slug: string; initial: Acceso[]; esOwner: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [accesos, setAccesos] = useState<Acceso[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Acceso | null>(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [filtroCat, setFiltroCat] = useState<string>("todos");
  const [query, setQuery] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({}); // id -> password
  const [revealing, setRevealing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showChangeCode, setShowChangeCode] = useState(false);

  // Conteos por categoría
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: accesos.length, favoritos: 0 };
    for (const a of accesos) {
      const k = a.categoria ?? "otro";
      c[k] = (c[k] ?? 0) + 1;
      if (a.favorito) c.favoritos += 1;
    }
    return c;
  }, [accesos]);

  // Listado filtrado
  const filtrados = useMemo(() => {
    let lista = accesos;
    if (filtroCat === "favoritos") lista = lista.filter(a => a.favorito);
    else if (filtroCat !== "todos") lista = lista.filter(a => (a.categoria ?? "otro") === filtroCat);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      lista = lista.filter(a =>
        a.etiqueta.toLowerCase().includes(q) ||
        (a.usuario?.toLowerCase().includes(q)) ||
        (a.persona?.toLowerCase().includes(q)) ||
        (a.notas?.toLowerCase().includes(q)) ||
        (a.url?.toLowerCase().includes(q))
      );
    }
    // Favoritos primero
    return [...lista].sort((a, b) => (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0));
  }, [accesos, filtroCat, query]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  function abrirCrear() {
    setForm({ ...FORM_DEFAULT, categoria: filtroCat !== "todos" && filtroCat !== "favoritos" ? filtroCat : "shopify" });
    setEditing(null);
    setShowForm(true);
  }

  async function abrirEditar(a: Acceso) {
    // Trae la password en claro on-demand
    let pwd = "";
    try {
      const res = await fetch(`/api/vault/reveal/${a.id}`);
      if (res.ok) pwd = (await res.json()).password ?? "";
    } catch {}
    setForm({
      categoria: a.categoria ?? "otro",
      etiqueta: a.etiqueta,
      persona: a.persona ?? "",
      usuario: a.usuario ?? "",
      password: pwd,
      url: a.url ?? "",
      notas: a.notas ?? "",
      favorito: a.favorito,
    });
    setEditing(a);
    setShowForm(true);
  }

  function cancelar() {
    setShowForm(false);
    setEditing(null);
    setForm(FORM_DEFAULT);
  }

  async function guardar() {
    const etiqueta = form.etiqueta.trim();
    if (!etiqueta) { showToast("Falta el nombre del acceso"); return; }
    setSaving(true);
    const payload: any = {
      espacio_id: espacioId,
      categoria: form.categoria,
      plataforma: form.categoria, // compatibilidad legacy
      etiqueta,
      persona: form.persona.trim() || null,
      usuario: form.usuario.trim() || null,
      password_enc: form.password || null,
      url: form.url.trim() || null,
      notas: form.notas.trim() || null,
      favorito: form.favorito,
    };
    if (editing) {
      const { data, error } = await supabase.from("emp_accesos").update(payload).eq("id", editing.id).select("id, espacio_id, categoria, plataforma, etiqueta, persona, usuario, url, notas, favorito, updated_at").single();
      setSaving(false);
      if (error) { showToast(error.message); return; }
      setAccesos(accesos.map(a => a.id === editing.id ? (data as Acceso) : a));
      showToast("Actualizado");
    } else {
      const { data, error } = await supabase.from("emp_accesos").insert(payload).select("id, espacio_id, categoria, plataforma, etiqueta, persona, usuario, url, notas, favorito, updated_at").single();
      setSaving(false);
      if (error) { showToast(error.message); return; }
      setAccesos([data as Acceso, ...accesos]);
      showToast("Creado");
    }
    cancelar();
    router.refresh();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este acceso?")) return;
    const { error } = await supabase.from("emp_accesos").delete().eq("id", id);
    if (error) { showToast(error.message); return; }
    setAccesos(accesos.filter(a => a.id !== id));
    showToast("Eliminado");
  }

  async function toggleFavorito(a: Acceso) {
    const next = !a.favorito;
    setAccesos(accesos.map(x => x.id === a.id ? { ...x, favorito: next } : x));
    const { error } = await supabase.from("emp_accesos").update({ favorito: next }).eq("id", a.id);
    if (error) {
      setAccesos(accesos.map(x => x.id === a.id ? { ...x, favorito: a.favorito } : x));
      showToast(error.message);
    }
  }

  async function revealPassword(id: string) {
    if (revealed[id]) {
      const next = { ...revealed };
      delete next[id];
      setRevealed(next);
      return;
    }
    setRevealing(id);
    try {
      const res = await fetch(`/api/vault/reveal/${id}`);
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "No se pudo leer"); return; }
      setRevealed({ ...revealed, [id]: json.password ?? "" });
    } finally {
      setRevealing(null);
    }
  }

  async function copyPassword(id: string) {
    let pwd = revealed[id];
    if (!pwd) {
      try {
        const res = await fetch(`/api/vault/reveal/${id}`);
        const json = await res.json();
        if (!res.ok) { showToast(json.error ?? "No se pudo leer"); return; }
        pwd = json.password ?? "";
      } catch {}
    }
    if (!pwd) { showToast("Sin contraseña"); return; }
    try {
      await navigator.clipboard.writeText(pwd);
      showToast("Contraseña copiada");
    } catch { showToast("No se pudo copiar"); }
  }

  async function copyText(text: string, label = "Copiado") {
    try {
      await navigator.clipboard.writeText(text);
      showToast(label);
    } catch { showToast("No se pudo copiar"); }
  }

  async function bloquear() {
    await fetch("/api/vault/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ espacioId }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md"></div>
            <KeyRound className="h-5 w-5 text-primary relative" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bóveda de Accesos</h1>
            <p className="text-xs text-muted-foreground">
              {accesos.length} {accesos.length === 1 ? "acceso" : "accesos"} · sesión activa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={bloquear}
            className="h-9 px-3 rounded-lg border border-input bg-card hover:bg-muted text-sm font-medium flex items-center gap-1.5 transition"
            title="Bloquear bóveda"
          >
            <Lock className="h-3.5 w-3.5" /> Bloquear
          </button>
          {esOwner && (
            <button
              onClick={() => setShowChangeCode(true)}
              className="h-9 w-9 rounded-lg border border-input bg-card hover:bg-muted flex items-center justify-center transition"
              title="Cambiar código"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
          <Button onClick={abrirCrear} className="shadow-md shadow-primary/20">
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, usuario, notas…"
          className="w-full h-11 pl-10 pr-10 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-[200px_1fr] gap-5">
        {/* Sidebar categorías */}
        <aside className="space-y-1 lg:sticky lg:top-4 lg:self-start">
          <SidebarItem
            icon={<KeyRound className="h-3.5 w-3.5" />}
            label="Todos"
            count={counts.todos ?? 0}
            active={filtroCat === "todos"}
            onClick={() => setFiltroCat("todos")}
          />
          <SidebarItem
            icon={<Star className="h-3.5 w-3.5 fill-current" />}
            label="Favoritos"
            count={counts.favoritos ?? 0}
            active={filtroCat === "favoritos"}
            onClick={() => setFiltroCat("favoritos")}
            iconColor="text-amber-500"
          />
          <div className="h-px bg-border my-2"></div>
          {CATEGORIAS.map(c => {
            const Icon = c.icon;
            return (
              <SidebarItem
                key={c.value}
                icon={<Icon className="h-3.5 w-3.5" />}
                label={c.label}
                count={counts[c.value] ?? 0}
                active={filtroCat === c.value}
                onClick={() => setFiltroCat(c.value)}
                iconColor={c.color}
              />
            );
          })}
        </aside>

        {/* Lista */}
        <div className="min-w-0 space-y-3">
          {/* Form inline */}
          {showForm && (
            <div className="rounded-xl border border-primary/30 bg-card shadow-lg shadow-primary/5">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">{editing ? "Editar acceso" : "Nuevo acceso"}</h3>
                <button onClick={cancelar} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Categoría</Label>
                    <select
                      value={form.categoria}
                      onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre *</Label>
                    <Input value={form.etiqueta} onChange={(e) => setForm({ ...form, etiqueta: e.target.value })} placeholder="Ej. Shopify Vasecom" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Responsable</Label>
                    <Input value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} placeholder="Quién lo administra" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Usuario / email</Label>
                    <Input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} placeholder="usuario@email.com" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Contraseña / token</Label>
                    <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="•••" className="font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">URL</Label>
                    <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Notas</Label>
                    <textarea
                      value={form.notas}
                      onChange={(e) => setForm({ ...form, notas: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      placeholder="2FA, recovery codes, plan, cookies..."
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.favorito}
                    onChange={(e) => setForm({ ...form, favorito: e.target.checked })}
                    className="rounded"
                  />
                  <Star className="h-4 w-4 text-amber-500" />
                  Marcar como favorito
                </label>
                <div className="flex gap-2 pt-1">
                  <Button onClick={guardar} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button variant="outline" onClick={cancelar}>Cancelar</Button>
                </div>
              </div>
            </div>
          )}

          {/* Cards */}
          {filtrados.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-card/50 py-16 text-center space-y-3">
              <KeyRound className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium">
                  {accesos.length === 0 ? "Tu bóveda está vacía" : "Sin resultados"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {accesos.length === 0
                    ? "Agrega tu primer acceso para empezar"
                    : query ? "Prueba con otra búsqueda" : "No hay accesos en esta categoría"}
                </p>
              </div>
              {accesos.length === 0 && (
                <Button onClick={abrirCrear} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Agregar el primero
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtrados.map(a => (
                <AccesoCard
                  key={a.id}
                  a={a}
                  revealed={revealed[a.id]}
                  revealing={revealing === a.id}
                  onReveal={() => revealPassword(a.id)}
                  onCopy={(text, label) => copyText(text, label)}
                  onCopyPassword={() => copyPassword(a.id)}
                  onEdit={() => abrirEditar(a)}
                  onDelete={() => borrar(a.id)}
                  onToggleFav={() => toggleFavorito(a)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-2">
          <Check className="h-4 w-4" />
          {toast}
        </div>
      )}

      {/* Modal cambiar código */}
      {showChangeCode && (
        <ChangeCodeModal espacioId={espacioId} onClose={() => setShowChangeCode(false)} onSuccess={() => { setShowChangeCode(false); showToast("Código actualizado"); }} />
      )}
    </div>
  );
}

function SidebarItem({ icon, label, count, active, onClick, iconColor }: {
  icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void; iconColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition group",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className={cn("shrink-0", active ? "text-primary" : iconColor ?? "")}>{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {count > 0 && (
        <span className={cn(
          "text-[10px] font-mono px-1.5 py-0.5 rounded",
          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}>{count}</span>
      )}
    </button>
  );
}

function AccesoCard({ a, revealed, revealing, onReveal, onCopy, onCopyPassword, onEdit, onDelete, onToggleFav }: {
  a: Acceso;
  revealed: string | undefined;
  revealing: boolean;
  onReveal: () => void;
  onCopy: (text: string, label?: string) => void;
  onCopyPassword: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFav: () => void;
}) {
  const meta = catMeta(a.categoria);
  const Icon = meta.icon;
  return (
    <div className="group rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={cn("w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0", meta.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold truncate text-sm">{a.etiqueta}</h3>
              {a.favorito && <Star className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {meta.label}{a.persona ? ` · ${a.persona}` : ""}
            </p>
          </div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconBtn title={a.favorito ? "Quitar favorito" : "Marcar favorito"} onClick={onToggleFav}>
              <Star className={cn("h-3 w-3", a.favorito && "fill-amber-500 text-amber-500")} />
            </IconBtn>
            <IconBtn title="Editar" onClick={onEdit}><Pencil className="h-3 w-3" /></IconBtn>
            <IconBtn title="Borrar" onClick={onDelete} danger><Trash2 className="h-3 w-3" /></IconBtn>
          </div>
        </div>

        {a.usuario && (
          <Field label="Usuario" value={a.usuario} onCopy={() => onCopy(a.usuario!, "Usuario copiado")} />
        )}

        <PasswordField
          hasPassword={true}
          revealed={revealed}
          revealing={revealing}
          onReveal={onReveal}
          onCopy={onCopyPassword}
        />

        {a.url && (
          <a href={a.url} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-primary hover:underline break-all flex items-center gap-1 group/url">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{a.url.replace(/^https?:\/\//, "")}</span>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-0 group-hover/url:opacity-100 -ml-0.5" />
          </a>
        )}

        {a.notas && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 pt-2 border-t border-border/50">
            {a.notas}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 group/field">
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        <div className="text-xs font-mono truncate">{value}</div>
      </div>
      <button onClick={onCopy} className="p-1 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover/field:opacity-100 transition-opacity" title="Copiar">
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function PasswordField({ hasPassword, revealed, revealing, onReveal, onCopy }: {
  hasPassword: boolean;
  revealed: string | undefined;
  revealing: boolean;
  onReveal: () => void;
  onCopy: () => void;
}) {
  if (!hasPassword) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 group/pwd">
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Contraseña</div>
        <div className="text-xs font-mono truncate tracking-wider">
          {revealing ? "..." : (revealed ?? "••••••••••")}
        </div>
      </div>
      <button onClick={onReveal} className="p-1 rounded hover:bg-muted text-muted-foreground" title={revealed ? "Ocultar" : "Mostrar"}>
        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
      <button onClick={onCopy} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Copiar contraseña">
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: {
  children: React.ReactNode; onClick: () => void; title: string; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground transition",
        danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ChangeCodeModal({ espacioId, onClose, onSuccess }: {
  espacioId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (next.length < 4) { setError("El nuevo código debe tener al menos 4 caracteres"); return; }
    if (next !== confirm) { setError("Los códigos no coinciden"); return; }
    setLoading(true);
    const res = await fetch("/api/vault/change-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ espacioId, currentCode: current, newCode: next }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "Error"); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-semibold">Cambiar código de bóveda</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Avísale al resto del equipo del nuevo código.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Código actual</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nuevo código</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confirmar nuevo código</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={loading || !current || !next || !confirm}>
              {loading ? "Cambiando..." : "Cambiar código"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
