"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Package, Plus, Trash2, Pencil, ExternalLink, Save, X as Close, Search,
  Beaker, Lightbulb, ShieldCheck, Trophy, XCircle, PauseCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils";

type Producto = {
  id: string; espacio_id: string; nombre: string; proveedor: string | null;
  pais: string | null; responsable_id: string | null;
  costo_proveedor: number | null; precio_final: number | null;
  precio_2und: number | null; precio_x3: number | null; stock: number | null;
  link_landing: string | null; link_drive: string | null; link_creativos: string | null;
  plataforma: string | null; tipo: string | null;
  estado: "testeo" | "aprendizaje" | "validado" | "winner" | "descartado" | "apagado";
  fecha_activacion_tt: string | null; fecha_activacion_fb: string | null;
  observacion: string | null; created_at: string;
};

const ESTADOS = [
  { value: "testeo",      label: "Testeo",       color: "bg-warning/15 text-warning",      icon: Beaker },
  { value: "aprendizaje", label: "Aprendizaje",  color: "bg-blue-500/15 text-blue-500",    icon: Lightbulb },
  { value: "validado",    label: "Validado",     color: "bg-success/15 text-success",      icon: ShieldCheck },
  { value: "winner",      label: "Winner",       color: "bg-primary/15 text-primary",      icon: Trophy },
  { value: "apagado",     label: "Apagado",      color: "bg-muted text-muted-foreground",  icon: PauseCircle },
  { value: "descartado",  label: "Descartado",   color: "bg-destructive/10 text-destructive", icon: XCircle },
] as const;

const PAISES = [
  { value: "CO", label: "🇨🇴 Colombia" },
  { value: "MX", label: "🇲🇽 México" },
  { value: "EC", label: "🇪🇨 Ecuador" },
  { value: "PE", label: "🇵🇪 Perú" },
  { value: "GT", label: "🇬🇹 Guatemala" },
  { value: "ES", label: "🇪🇸 España" },
  { value: "CL", label: "🇨🇱 Chile" },
  { value: "USA", label: "🇺🇸 USA" },
  { value: "OTRO", label: "Otro" },
];

type FormState = Partial<Producto>;
const FORM_DEFAULT: FormState = { estado: "testeo", plataforma: "TT+FB", tipo: "dropshipping", pais: "CO" };

export function ProductosClient({ espacioId, moneda, productos: initial, miembros }: {
  espacioId: string; moneda: string;
  productos: Producto[];
  miembros: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [productos, setProductos] = useState<Producto[]>(initial);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return productos.filter(p => {
      if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
      if (q && !(p.nombre.toLowerCase().includes(q) || (p.proveedor ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [productos, filtroEstado, busqueda]);

  const conteoPorEstado = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of productos) m[p.estado] = (m[p.estado] ?? 0) + 1;
    return m;
  }, [productos]);

  function abrirCrear() {
    setForm({ ...FORM_DEFAULT });
    setEditing(null);
    setShowForm(true);
  }
  function abrirEditar(p: Producto) {
    setForm(p);
    setEditing(p.id);
    setShowForm(true);
  }
  function cancelar() {
    setShowForm(false);
    setEditing(null);
    setForm(FORM_DEFAULT);
  }

  async function guardar() {
    const nombre = (form.nombre ?? "").trim();
    if (!nombre) { alert("Falta el nombre del producto"); return; }
    setSaving(true);
    const payload: any = {
      espacio_id: espacioId,
      nombre, proveedor: form.proveedor || null, pais: form.pais || null,
      responsable_id: form.responsable_id || null,
      costo_proveedor: form.costo_proveedor || null,
      precio_final: form.precio_final || null,
      precio_2und: form.precio_2und || null,
      precio_x3: form.precio_x3 || null,
      stock: form.stock ?? 0,
      link_landing: form.link_landing || null,
      link_drive: form.link_drive || null,
      link_creativos: form.link_creativos || null,
      plataforma: form.plataforma || null,
      tipo: form.tipo || "dropshipping",
      estado: form.estado || "testeo",
      fecha_activacion_tt: form.fecha_activacion_tt || null,
      fecha_activacion_fb: form.fecha_activacion_fb || null,
      observacion: form.observacion || null,
    };
    if (editing) {
      const { data, error } = await supabase.from("emp_productos").update(payload).eq("id", editing).select().single();
      setSaving(false);
      if (error) { alert(error.message); return; }
      setProductos(productos.map(p => p.id === editing ? (data as Producto) : p));
    } else {
      const { data, error } = await supabase.from("emp_productos").insert(payload).select().single();
      setSaving(false);
      if (error) { alert(error.message); return; }
      setProductos([data as Producto, ...productos]);
    }
    cancelar();
    router.refresh();
  }

  async function borrar(id: string, nombre: string) {
    if (!confirm(`¿Borrar el producto "${nombre}"? Sus campañas asociadas quedarán huérfanas.`)) return;
    const { error } = await supabase.from("emp_productos").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setProductos(productos.filter(p => p.id !== id));
    router.refresh();
  }

  async function cambiarEstado(id: string, nuevoEstado: Producto["estado"]) {
    const { error } = await supabase.from("emp_productos").update({ estado: nuevoEstado }).eq("id", id);
    if (error) { alert(error.message); return; }
    setProductos(productos.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" /> Productos
          </h1>
          <p className="text-muted-foreground text-sm">Catálogo de tu negocio. Estados: testeo → aprendizaje → validado → winner.</p>
        </div>
        <Button onClick={abrirCrear}><Plus className="h-4 w-4 mr-1" /> Nuevo producto</Button>
      </div>

      {/* KPIs por estado */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <FiltroChip
          label="Todos" count={productos.length} activo={filtroEstado === "todos"}
          onClick={() => setFiltroEstado("todos")}
        />
        {ESTADOS.map(e => (
          <FiltroChip
            key={e.value}
            label={e.label}
            count={conteoPorEstado[e.value] ?? 0}
            activo={filtroEstado === e.value}
            color={e.color}
            icon={<e.icon className="h-3.5 w-3.5" />}
            onClick={() => setFiltroEstado(e.value)}
          />
        ))}
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nombre o proveedor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Formulario */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editing ? "Editar producto" : "Nuevo producto"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Nombre *" name="nombre" value={form.nombre ?? ""} onChange={(v) => setForm({ ...form, nombre: v })} placeholder="Ej. Procesador de alimentos" />
              <Field label="Proveedor" name="proveedor" value={form.proveedor ?? ""} onChange={(v) => setForm({ ...form, proveedor: v })} placeholder="Oh Homie" />
              <SelectField label="País" value={form.pais ?? ""} onChange={(v) => setForm({ ...form, pais: v })} options={PAISES} />
              <SelectField
                label="Responsable"
                value={form.responsable_id ?? ""}
                onChange={(v) => setForm({ ...form, responsable_id: v || null })}
                options={[{ value: "", label: "— Sin asignar —" }, ...miembros.map(m => ({ value: m.id, label: m.nombre }))]}
              />
              <SelectField
                label="Estado"
                value={form.estado ?? "testeo"}
                onChange={(v) => setForm({ ...form, estado: v as any })}
                options={ESTADOS.map(e => ({ value: e.value, label: e.label }))}
              />
              <SelectField
                label="Plataforma"
                value={form.plataforma ?? ""}
                onChange={(v) => setForm({ ...form, plataforma: v })}
                options={[
                  { value: "TT", label: "TikTok" },
                  { value: "FB", label: "Facebook" },
                  { value: "TT+FB", label: "TikTok + Facebook" },
                  { value: "Otro", label: "Otro" },
                ]}
              />
              <NumField label={`Costo proveedor (${moneda})`} value={form.costo_proveedor} onChange={(v) => setForm({ ...form, costo_proveedor: v })} />
              <NumField label={`Precio final (${moneda})`} value={form.precio_final} onChange={(v) => setForm({ ...form, precio_final: v })} />
              <NumField label={`Precio 2 und (${moneda})`} value={form.precio_2und} onChange={(v) => setForm({ ...form, precio_2und: v })} />
              <NumField label={`Precio x3 (${moneda})`} value={form.precio_x3} onChange={(v) => setForm({ ...form, precio_x3: v })} />
              <NumField label="Stock" value={form.stock} onChange={(v) => setForm({ ...form, stock: v })} step={1} />
              <SelectField
                label="Tipo"
                value={form.tipo ?? "dropshipping"}
                onChange={(v) => setForm({ ...form, tipo: v })}
                options={[
                  { value: "dropshipping", label: "Dropshipping" },
                  { value: "importacion",  label: "Importación" },
                  { value: "local",        label: "Local" },
                  { value: "otro",         label: "Otro" },
                ]}
              />
              <Field label="Link landing" name="link_landing" value={form.link_landing ?? ""} onChange={(v) => setForm({ ...form, link_landing: v })} placeholder="https://..." />
              <Field label="Link drive" name="link_drive" value={form.link_drive ?? ""} onChange={(v) => setForm({ ...form, link_drive: v })} placeholder="https://drive.google.com/..." />
              <Field label="Link creativos" name="link_creativos" value={form.link_creativos ?? ""} onChange={(v) => setForm({ ...form, link_creativos: v })} placeholder="https://..." />
              <Field label="Fecha activación TT" name="ftt" type="date" value={form.fecha_activacion_tt ?? ""} onChange={(v) => setForm({ ...form, fecha_activacion_tt: v })} />
              <Field label="Fecha activación FB" name="ffb" type="date" value={form.fecha_activacion_fb ?? ""} onChange={(v) => setForm({ ...form, fecha_activacion_fb: v })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="obs">Observación</Label>
              <textarea
                id="obs" rows={2} value={form.observacion ?? ""}
                onChange={(e) => setForm({ ...form, observacion: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Notas, hallazgos, contexto del producto..."
              />
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

      {/* Tabla de productos */}
      {filtrados.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <Package className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {productos.length === 0 ? "Aún no tienes productos registrados." : "No hay productos que coincidan con tu filtro."}
            </p>
            {productos.length === 0 && (
              <Button onClick={abrirCrear} variant="outline"><Plus className="h-4 w-4 mr-1" /> Agregar el primero</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map(p => (
            <ProductoCard
              key={p.id}
              p={p}
              moneda={moneda}
              onEditar={() => abrirEditar(p)}
              onBorrar={() => borrar(p.id, p.nombre)}
              onCambiarEstado={(nuevo) => cambiarEstado(p.id, nuevo)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductoCard({ p, moneda, onEditar, onBorrar, onCambiarEstado }: {
  p: Producto; moneda: string;
  onEditar: () => void; onBorrar: () => void;
  onCambiarEstado: (n: Producto["estado"]) => void;
}) {
  const estadoCfg = ESTADOS.find(e => e.value === p.estado);
  const Icon = estadoCfg?.icon ?? Beaker;
  const pais = PAISES.find(c => c.value === p.pais);
  return (
    <Card className="overflow-hidden hover:border-primary/40 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{p.nombre}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {p.proveedor ?? "—"} {pais && `· ${pais.label}`}
            </p>
          </div>
          <span className={cn("text-[10px] uppercase tracking-wide px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1 shrink-0", estadoCfg?.color)}>
            <Icon className="h-3 w-3" /> {estadoCfg?.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Costo</span>
            <div className="font-medium tabular-nums">{p.costo_proveedor ? formatMoney(p.costo_proveedor, moneda) : "—"}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Precio</span>
            <div className="font-medium tabular-nums">{p.precio_final ? formatMoney(p.precio_final, moneda) : "—"}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Stock</span>
            <div className="font-medium tabular-nums">{p.stock ?? 0}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Plataforma</span>
            <div className="font-medium">{p.plataforma ?? "—"}</div>
          </div>
        </div>

        {(p.link_landing || p.link_drive || p.link_creativos) && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t">
            {p.link_landing && <LinkBtn label="Landing" href={p.link_landing} />}
            {p.link_drive && <LinkBtn label="Drive" href={p.link_drive} />}
            {p.link_creativos && <LinkBtn label="Creativos" href={p.link_creativos} />}
          </div>
        )}

        {/* Selector rápido de estado */}
        <div className="flex flex-wrap gap-1 pt-1 border-t">
          {ESTADOS.map(e => (
            <button
              key={e.value}
              onClick={() => p.estado !== e.value && onCambiarEstado(e.value as Producto["estado"])}
              className={cn(
                "text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold transition",
                p.estado === e.value ? e.color : "text-muted-foreground hover:bg-muted"
              )}
              title={`Cambiar a ${e.label}`}
            >
              {e.label.slice(0, 4)}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-1 pt-1">
          <Button size="icon" variant="ghost" onClick={onEditar} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onBorrar} className="h-7 w-7 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LinkBtn({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition"
    >
      <ExternalLink className="h-2.5 w-2.5" /> {label}
    </a>
  );
}

function FiltroChip({ label, count, activo, onClick, color, icon }: {
  label: string; count: number; activo: boolean; onClick: () => void; color?: string; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border bg-card p-2.5 text-left transition hover:border-primary/40",
        activo && "border-primary bg-primary/5"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {icon && <span className={cn("inline-flex", color?.split(" ")[1])}>{icon}</span>}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums mt-0.5">{count}</div>
    </button>
  );
}

function Field({ label, name, value, onChange, placeholder, type = "text" }: {
  label: string; name: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function NumField({ label, value, onChange, step = 0.01 }: {
  label: string; value: number | null | undefined; onChange: (v: number | null) => void; step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number" step={step} value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
