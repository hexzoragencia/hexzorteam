"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  KeyRound, Plus, Trash2, Pencil, Eye, EyeOff, Copy, Save, ShieldAlert, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Acceso = {
  id: string; espacio_id: string;
  plataforma: string; etiqueta: string;
  persona: string | null; usuario: string | null;
  password_enc: string | null; url: string | null; notas: string | null;
};

const PLATAFORMAS = [
  { value: "tiktok",         label: "TikTok",          flag: "🎵" },
  { value: "facebook",       label: "Facebook",        flag: "🟦" },
  { value: "meta_business",  label: "Meta Business",   flag: "🏢" },
  { value: "instagram",      label: "Instagram",       flag: "📷" },
  { value: "google",         label: "Google",          flag: "🔍" },
  { value: "shopify",        label: "Shopify",         flag: "🛍️" },
  { value: "pagina",         label: "Página",          flag: "🌐" },
  { value: "dominio",        label: "Dominio",         flag: "📡" },
  { value: "tienda",         label: "Tienda",          flag: "🏬" },
  { value: "correo",         label: "Correo",          flag: "✉️" },
  { value: "banco",          label: "Banco",           flag: "🏦" },
  { value: "otro",           label: "Otro",            flag: "🔐" },
];

const FORM_DEFAULT = { plataforma: "tiktok", etiqueta: "", persona: "", usuario: "", password_enc: "", url: "", notas: "" };

export function AccesosClient({ espacioId, initial, esOwner }: { espacioId: string; initial: Acceso[]; esOwner: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [accesos, setAccesos] = useState<Acceso[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [filtroPlat, setFiltroPlat] = useState<string>("todos");

  const grupos = useMemo(() => {
    const g: Record<string, Acceso[]> = {};
    for (const a of accesos) (g[a.plataforma] ??= []).push(a);
    return g;
  }, [accesos]);

  const filtrados = filtroPlat === "todos" ? accesos : (grupos[filtroPlat] ?? []);

  function abrirCrear() {
    setForm(FORM_DEFAULT); setEditing(null); setShowForm(true);
  }
  function abrirEditar(a: Acceso) {
    setForm({
      plataforma: a.plataforma, etiqueta: a.etiqueta,
      persona: a.persona ?? "", usuario: a.usuario ?? "",
      password_enc: a.password_enc ?? "", url: a.url ?? "", notas: a.notas ?? "",
    });
    setEditing(a.id); setShowForm(true);
  }
  function cancelar() {
    setShowForm(false); setEditing(null); setForm(FORM_DEFAULT);
  }

  async function guardar() {
    const etiqueta = form.etiqueta.trim();
    if (!etiqueta) { alert("Falta la etiqueta (qué cuenta es)"); return; }
    setSaving(true);
    const payload: any = {
      espacio_id: espacioId,
      plataforma: form.plataforma,
      etiqueta,
      persona: form.persona.trim() || null,
      usuario: form.usuario.trim() || null,
      password_enc: form.password_enc || null,
      url: form.url.trim() || null,
      notas: form.notas.trim() || null,
    };
    if (editing) {
      const { data, error } = await supabase.from("emp_accesos").update(payload).eq("id", editing).select().single();
      setSaving(false);
      if (error) { alert(error.message); return; }
      setAccesos(accesos.map(a => a.id === editing ? (data as Acceso) : a));
    } else {
      const { data, error } = await supabase.from("emp_accesos").insert(payload).select().single();
      setSaving(false);
      if (error) { alert(error.message); return; }
      setAccesos([data as Acceso, ...accesos]);
    }
    cancelar();
    router.refresh();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este acceso?")) return;
    const { error } = await supabase.from("emp_accesos").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setAccesos(accesos.filter(a => a.id !== id));
    router.refresh();
  }

  async function copiar(text: string) {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }

  if (!esOwner) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <KeyRound className="h-7 w-7 text-primary" /> Bóveda de Accesos
          </h1>
        </div>
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="py-10 text-center space-y-3">
            <ShieldAlert className="h-12 w-12 mx-auto text-warning" />
            <h3 className="font-semibold">Acceso restringido</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              La bóveda de accesos solo es visible para el <b>dueño (owner)</b> del espacio.
              Si necesitas las credenciales, pide al dueño que te las comparta directamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <KeyRound className="h-7 w-7 text-primary" /> Bóveda de Accesos
          </h1>
          <p className="text-muted-foreground text-sm">Credenciales del equipo. Solo tú (owner) las ves.</p>
        </div>
        <Button onClick={abrirCrear}><Plus className="h-4 w-4 mr-1" /> Nuevo acceso</Button>
      </div>

      {/* Aviso de seguridad */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="py-3 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Las contraseñas se almacenan en la base de datos. Esta sección solo es visible para owners del espacio. Para máxima seguridad, considera usar 1Password o Bitwarden para datos sensibles.</span>
        </CardContent>
      </Card>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editing ? "Editar acceso" : "Nuevo acceso"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Plataforma</Label>
                <select
                  value={form.plataforma}
                  onChange={(e) => setForm({ ...form, plataforma: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {PLATAFORMAS.map(p => <option key={p.value} value={p.value}>{p.flag} {p.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Etiqueta *</Label>
                <Input value={form.etiqueta} onChange={(e) => setForm({ ...form, etiqueta: e.target.value })} placeholder="Ej. TikTok ads Vasecom" />
              </div>
              <div className="space-y-1">
                <Label>Persona / responsable</Label>
                <Input value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} placeholder="Valentina, Sebas..." />
              </div>
              <div className="space-y-1">
                <Label>Usuario / email</Label>
                <Input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} placeholder="usuario@email.com" />
              </div>
              <div className="space-y-1">
                <Label>Contraseña</Label>
                <Input type="text" value={form.password_enc} onChange={(e) => setForm({ ...form, password_enc: e.target.value })} placeholder="•••••" />
              </div>
              <div className="space-y-1">
                <Label>URL (opcional)</Label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Notas (opcional)</Label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="2FA, tarjetas asociadas, plan, etc."
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

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <FiltroChip label="Todos" count={accesos.length} activo={filtroPlat === "todos"} onClick={() => setFiltroPlat("todos")} />
        {PLATAFORMAS.filter(p => grupos[p.value]?.length).map(p => (
          <FiltroChip
            key={p.value}
            label={`${p.flag} ${p.label}`}
            count={grupos[p.value]?.length ?? 0}
            activo={filtroPlat === p.value}
            onClick={() => setFiltroPlat(p.value)}
          />
        ))}
      </div>

      {/* Listado */}
      {filtrados.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <KeyRound className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {accesos.length === 0 ? "Aún no tienes credenciales guardadas." : "No hay credenciales en esta plataforma."}
            </p>
            {accesos.length === 0 && (
              <Button onClick={abrirCrear} variant="outline"><Plus className="h-4 w-4 mr-1" /> Agregar el primero</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtrados.map(a => {
            const plat = PLATAFORMAS.find(p => p.value === a.plataforma);
            const isRevealed = !!revealed[a.id];
            return (
              <Card key={a.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{plat?.flag} {plat?.label}</div>
                      <h3 className="font-semibold truncate">{a.etiqueta}</h3>
                      {a.persona && <p className="text-xs text-muted-foreground">👤 {a.persona}</p>}
                    </div>
                    <div className="flex gap-0.5 -mr-1 -mt-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => abrirEditar(a)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => borrar(a.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {a.usuario && (
                    <CredField label="Usuario" value={a.usuario} reveal />
                  )}
                  {a.password_enc && (
                    <CredField
                      label="Contraseña"
                      value={a.password_enc}
                      reveal={isRevealed}
                      onToggle={() => setRevealed({ ...revealed, [a.id]: !isRevealed })}
                      sensitive
                    />
                  )}

                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline break-all flex items-center gap-1">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{a.url.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}

                  {a.notas && <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t">{a.notas}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CredField({ label, value, reveal, onToggle, sensitive }: {
  label: string; value: string; reveal: boolean; onToggle?: () => void; sensitive?: boolean;
}) {
  const display = reveal ? value : "•".repeat(Math.min(value.length, 12));
  async function copiar() {
    try { await navigator.clipboard.writeText(value); } catch { /* ignore */ }
  }
  return (
    <div className="rounded-md border bg-muted/30 px-2.5 py-1.5 flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("text-sm font-mono truncate", !reveal && sensitive && "tracking-wider")}>
          {display}
        </div>
      </div>
      <div className="flex gap-0.5 shrink-0">
        {sensitive && onToggle && (
          <button onClick={onToggle} className="p-1 rounded hover:bg-muted text-muted-foreground" title={reveal ? "Ocultar" : "Mostrar"}>
            {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <button onClick={copiar} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Copiar">
          <Copy className="h-3.5 w-3.5" />
        </button>
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
