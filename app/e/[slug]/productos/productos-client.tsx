"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Package, Plus, Trash2, Pencil, ExternalLink, Save, X as Close, Search,
  Beaker, Lightbulb, ShieldCheck, Trophy, XCircle, PauseCircle, Sparkles,
  ChevronLeft, ChevronRight as ChevronRight2, ChevronDown, Tag, DollarSign,
  Link as LinkIcon, Calendar as CalendarIcon, StickyNote, ArrowRight,
  MoreHorizontal, User as UserIcon, Compass, RefreshCw,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

type Producto = {
  id: string; espacio_id: string; nombre: string; proveedor: string | null;
  pais: string | null; responsable: string | null;
  costo_proveedor: number | null; precio_final: number | null;
  precio_2und: number | null; precio_x3: number | null; stock: number | null;
  link_landing: string | null; link_drive: string | null; link_creativos: string | null;
  dropi_url: string | null; link_referencia: string | null;
  imagen_url: string | null;
  plataforma: string | null; tipo: string | null;
  estado: "investigado" | "nuevo" | "testeo" | "aprendizaje" | "validado" | "winner" | "relanzamiento" | "descartado" | "apagado";
  fecha_activacion_tt: string | null; fecha_activacion_fb: string | null;
  observacion: string | null; created_at: string;
};

const ESTADOS = [
  { value: "investigado", label: "Investigado",  short: "Invest.",  icon: Compass,      dot: "bg-cyan-500",    text: "text-cyan-600 dark:text-cyan-400",     bar: "bg-cyan-500",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30" },
  { value: "nuevo",       label: "Nuevo",        short: "Nuevo",    icon: Sparkles,     dot: "bg-violet-500",  text: "text-violet-600 dark:text-violet-400", bar: "bg-violet-500",  bg: "bg-violet-500/10",  border: "border-violet-500/30" },
  { value: "testeo",      label: "Testeo",       short: "Testeo",   icon: Beaker,       dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400",  bar: "bg-amber-500",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  { value: "aprendizaje", label: "Aprendizaje",  short: "Aprende",  icon: Lightbulb,    dot: "bg-blue-500",    text: "text-blue-600 dark:text-blue-400",    bar: "bg-blue-500",    bg: "bg-blue-500/10",    border: "border-blue-500/30" },
  { value: "validado",    label: "Validado",     short: "Validado", icon: ShieldCheck,  dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  { value: "winner",      label: "Winner",       short: "Winner",   icon: Trophy,       dot: "bg-primary",     text: "text-primary",                        bar: "bg-primary",     bg: "bg-primary/10",     border: "border-primary/30" },
  { value: "relanzamiento", label: "Relanzamiento", short: "Relanza.", icon: RefreshCw,    dot: "bg-orange-500",  text: "text-orange-600 dark:text-orange-400", bar: "bg-orange-500",  bg: "bg-orange-500/10",  border: "border-orange-500/30" },
  { value: "apagado",     label: "Apagado",      short: "Apagado",  icon: PauseCircle,  dot: "bg-zinc-400",    text: "text-zinc-500",                       bar: "bg-zinc-400",    bg: "bg-zinc-500/10",    border: "border-zinc-500/30" },
  { value: "descartado",  label: "Descartado",   short: "Descart.", icon: XCircle,      dot: "bg-rose-500",    text: "text-rose-600 dark:text-rose-400",    bar: "bg-rose-500",    bg: "bg-rose-500/10",    border: "border-rose-500/30" },
] as const;

const ESTADOS_FLUJO = ["investigado", "nuevo", "testeo", "aprendizaje", "validado", "winner"] as const;
const ESTADOS_INACTIVOS = ["relanzamiento", "apagado", "descartado"] as const;

const PAISES = [
  { value: "CO", flag: "🇨🇴", label: "Colombia" },
  { value: "MX", flag: "🇲🇽", label: "México" },
  { value: "EC", flag: "🇪🇨", label: "Ecuador" },
  { value: "PE", flag: "🇵🇪", label: "Perú" },
  { value: "GT", flag: "🇬🇹", label: "Guatemala" },
  { value: "ES", flag: "🇪🇸", label: "España" },
  { value: "CL", flag: "🇨🇱", label: "Chile" },
  { value: "USA", flag: "🇺🇸", label: "USA" },
  { value: "OTRO", flag: "🌐", label: "Otro" },
];

type FormState = Partial<Producto>;
const FORM_DEFAULT: FormState = { estado: "testeo", plataforma: "TT+FB", tipo: "dropshipping", pais: "CO" };

function getEstado(v?: string) {
  return ESTADOS.find(e => e.value === v) ?? ESTADOS[0];
}

function calcMargen(precio?: number | null, costo?: number | null): number | null {
  if (!precio || !costo || precio <= 0) return null;
  return Math.round(((precio - costo) / precio) * 100);
}

// Dropi: acepta una URL completa o solo el ID numérico.
// Devuelve el href clickeable y la etiqueta (ID si se puede extraer).
function dropiHref(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^\d+$/.test(t)) return `https://app.dropi.co/dashboard/product-details/${t}`;
  return "https://" + t;
}
function dropiLabel(v: string | null): string {
  if (!v) return "Dropi";
  const m = v.match(/(\d{3,})/);
  return m ? `Dropi #${m[1]}` : "Dropi";
}

// Comprime una imagen a miniatura (~320px, JPEG) para guardarla liviana.
async function comprimirImagen(file: File, max = 320): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * escala);
      const h = Math.round(img.height * escala);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) { res(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      res(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}

function iniciales(nombre?: string): string {
  if (!nombre) return "?";
  return nombre.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("");
}

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
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

  // Filtrado
  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return productos.filter(p => {
      if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
      if (q && !(p.nombre.toLowerCase().includes(q) || (p.proveedor ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [productos, filtroEstado, busqueda]);

  // Conteos y stats por estado
  const stats = useMemo(() => {
    const m: Record<string, { count: number; invertido: number }> = {};
    for (const e of ESTADOS) m[e.value] = { count: 0, invertido: 0 };
    for (const p of productos) {
      const k = p.estado;
      if (!m[k]) m[k] = { count: 0, invertido: 0 };
      m[k].count += 1;
      if (p.costo_proveedor && p.stock) m[k].invertido += p.costo_proveedor * p.stock;
    }
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
      responsable: form.responsable?.trim() || null,
      costo_proveedor: form.costo_proveedor || null,
      precio_final: form.precio_final || null,
      precio_2und: form.precio_2und || null,
      precio_x3: form.precio_x3 || null,
      stock: form.stock ?? 0,
      link_landing: form.link_landing || null,
      link_drive: form.link_drive || null,
      link_creativos: form.link_creativos || null,
      dropi_url: form.dropi_url?.trim() || null,
      link_referencia: form.link_referencia?.trim() || null,
      imagen_url: form.imagen_url?.trim() || null,
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
    setMenuAbierto(null);
    const { error } = await supabase.from("emp_productos").update({ estado: nuevoEstado }).eq("id", id);
    if (error) { alert(error.message); return; }
    setProductos(productos.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
    router.refresh();
  }

  // El responsable ahora es texto libre — solo lo pasamos tal cual.
  const responsableNombre = (texto: string | null) => texto;

  return (
    <div className="space-y-6" onClick={() => setMenuAbierto(null)}>
      {/* ====== HEADER ====== */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md"></div>
            <Package className="h-5 w-5 text-primary relative" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
            <p className="text-xs text-muted-foreground">
              {productos.length} {productos.length === 1 ? "producto" : "productos"} en el catálogo
            </p>
          </div>
        </div>
        <Button onClick={abrirCrear} className="shadow-md shadow-primary/20">
          <Plus className="h-4 w-4 mr-1.5" /> Nuevo producto
        </Button>
      </div>

      {/* ====== BUSCADOR ====== */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o proveedor…"
          className="pl-10 h-11"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground"
          >
            <Close className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ====== PIPELINE VISUAL — FLUJO DEL PRODUCTO ====== */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Flujo del producto</h2>
          {filtroEstado !== "todos" && (
            <button onClick={() => setFiltroEstado("todos")} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Close className="h-3 w-3" /> Quitar filtro
            </button>
          )}
        </div>

        {/* Flujo: Investigado → Nuevo → Testeo → Aprendizaje → Validado → Winner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-0 lg:items-stretch">
          {ESTADOS_FLUJO.map((v, idx) => {
            const e = getEstado(v);
            const s = stats[v];
            const activo = filtroEstado === v;
            const total = filtroEstado === "todos" ? productos.length : (stats[filtroEstado]?.count ?? 0);
            return (
              <div key={v} className="flex items-stretch">
                <button
                  onClick={() => setFiltroEstado(activo ? "todos" : v)}
                  className={cn(
                    "flex-1 group relative text-left rounded-xl border bg-card p-3 transition-all",
                    activo
                      ? cn(e.border, e.bg, "shadow-md")
                      : "border-border hover:border-primary/30 hover:shadow-sm",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", e.dot)}></span>
                    <span className={cn("text-[11px] uppercase tracking-wider font-semibold", activo ? e.text : "text-muted-foreground")}>
                      {e.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className={cn("text-2xl font-bold tabular-nums", activo && e.text)}>{s?.count ?? 0}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {s?.count === 1 ? "producto" : "productos"}
                    </span>
                  </div>
                </button>
                {idx < ESTADOS_FLUJO.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center px-1.5 shrink-0">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Estados inactivos: Apagado · Descartado */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setFiltroEstado("todos")}
            className={cn(
              "text-[11px] px-3 py-1.5 rounded-full border transition",
              filtroEstado === "todos"
                ? "bg-primary/10 border-primary/30 text-primary font-medium"
                : "bg-card border-border text-muted-foreground hover:border-primary/30",
            )}
          >
            Todos · {productos.length}
          </button>
          {ESTADOS_INACTIVOS.map(v => {
            const e = getEstado(v);
            const s = stats[v];
            const activo = filtroEstado === v;
            return (
              <button
                key={v}
                onClick={() => setFiltroEstado(activo ? "todos" : v)}
                className={cn(
                  "text-[11px] px-3 py-1.5 rounded-full border transition inline-flex items-center gap-1.5",
                  activo
                    ? cn(e.border, e.bg, e.text, "font-medium")
                    : "bg-card border-border text-muted-foreground hover:border-primary/30",
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", e.dot)}></span>
                {e.label} · {s?.count ?? 0}
              </button>
            );
          })}
        </div>
      </div>

      {/* ====== FORMULARIO ====== */}
      {showForm && (
        <FormularioProducto
          form={form}
          setForm={setForm}
          editing={!!editing}
          saving={saving}
          moneda={moneda}
          miembros={miembros}
          onGuardar={guardar}
          onCancelar={cancelar}
        />
      )}

      {/* ====== LISTADO ====== */}
      {filtrados.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-card/40 py-16 text-center space-y-3">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium">
              {productos.length === 0 ? "Aún no tienes productos" : "Sin resultados"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {productos.length === 0
                ? "Crea el primero para empezar a operar"
                : busqueda ? "Prueba con otra búsqueda" : "No hay productos en este estado"}
            </p>
          </div>
          {productos.length === 0 && (
            <Button onClick={abrirCrear} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Crear el primero
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(p => (
            <ProductoFila
              key={p.id}
              p={p}
              moneda={moneda}
              responsable={responsableNombre(p.responsable)}
              menuAbierto={menuAbierto === p.id}
              onAbrirMenu={(open) => setMenuAbierto(open ? p.id : null)}
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

// ============================================================
// CARRUSEL HORIZONTAL — productos en línea con scroll y flechas
// ============================================================
function CarruselProductos({ productos, moneda, menuAbiertoId, onAbrirMenu, responsableNombre, onEditar, onBorrar, onCambiarEstado }: {
  productos: Producto[];
  moneda: string;
  menuAbiertoId: string | null;
  onAbrirMenu: (id: string | null) => void;
  responsableNombre: (id: string | null) => string | null;
  onEditar: (p: Producto) => void;
  onBorrar: (p: Producto) => void;
  onCambiarEstado: (id: string, nuevo: Producto["estado"]) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [puedeIzq, setPuedeIzq] = useState(false);
  const [puedeDer, setPuedeDer] = useState(false);

  function actualizarFlechas() {
    const el = scrollRef.current;
    if (!el) return;
    setPuedeIzq(el.scrollLeft > 8);
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }

  useEffect(() => {
    actualizarFlechas();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", actualizarFlechas, { passive: true });
    window.addEventListener("resize", actualizarFlechas);
    return () => {
      el.removeEventListener("scroll", actualizarFlechas);
      window.removeEventListener("resize", actualizarFlechas);
    };
  }, [productos.length]);

  function scrollPor(dir: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-prod-card]");
    const cardW = card ? card.offsetWidth + 12 : 320;
    el.scrollBy({ left: dir * cardW * 2, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {/* Botón izquierda */}
      {puedeIzq && (
        <button
          onClick={() => scrollPor(-1)}
          className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-card border border-border shadow-lg items-center justify-center hover:bg-muted hover:border-primary/40 transition"
          title="Anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {/* Botón derecha */}
      {puedeDer && (
        <button
          onClick={() => scrollPor(1)}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-card border border-border shadow-lg items-center justify-center hover:bg-muted hover:border-primary/40 transition"
          title="Siguiente"
        >
          <ChevronRight2 className="h-4 w-4" />
        </button>
      )}

      {/* Pista de scroll horizontal */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 -mx-1 px-1 carrusel-productos"
      >
        {productos.map(p => (
          <div
            key={p.id}
            data-prod-card
            className="snap-start shrink-0 w-[320px] sm:w-[340px]"
          >
            <ProductoCard
              p={p}
              moneda={moneda}
              responsable={responsableNombre(p.responsable)}
              menuAbierto={menuAbiertoId === p.id}
              onAbrirMenu={(open) => onAbrirMenu(open ? p.id : null)}
              onEditar={() => onEditar(p)}
              onBorrar={() => onBorrar(p)}
              onCambiarEstado={(nuevo) => onCambiarEstado(p.id, nuevo)}
            />
          </div>
        ))}
      </div>

      {/* Indicador de cuántos hay */}
      {productos.length > 3 && (
        <div className="text-[10px] text-muted-foreground text-right mt-1">
          Desliza para ver los {productos.length} productos →
        </div>
      )}

      <style jsx global>{`
        .carrusel-productos::-webkit-scrollbar { height: 6px; }
        .carrusel-productos::-webkit-scrollbar-track { background: transparent; }
        .carrusel-productos::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 3px; }
        .carrusel-productos::-webkit-scrollbar-thumb:hover { background: hsl(var(--primary) / 0.3); }
      `}</style>
    </div>
  );
}

// ============================================================
// CARD DE PRODUCTO — jerarquía visual clara
// ============================================================
function ProductoCard({ p, moneda, responsable, menuAbierto, onAbrirMenu, onEditar, onBorrar, onCambiarEstado }: {
  p: Producto; moneda: string; responsable: string | null;
  menuAbierto: boolean; onAbrirMenu: (open: boolean) => void;
  onEditar: () => void; onBorrar: () => void;
  onCambiarEstado: (n: Producto["estado"]) => void;
}) {
  const e = getEstado(p.estado);
  const Icon = e.icon;
  const pais = PAISES.find(c => c.value === p.pais);
  const margen = calcMargen(p.precio_final, p.costo_proveedor);
  const tieneLinks = !!(p.link_landing || p.link_drive || p.link_creativos || p.dropi_url || p.link_referencia);

  return (
    <div className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
      {/* Banda superior con color de estado */}
      <div className={cn("h-1 w-full", e.bar)}></div>

      <div className="p-4 space-y-3">
        {/* Cabecera: foto + nombre + estado + menú */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-start gap-2.5">
            {p.imagen_url && (
              <img src={p.imagen_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-[15px] leading-tight truncate">{p.nombre}</h3>
              <div className={cn("inline-flex items-center gap-1 mt-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded", e.bg, e.text)}>
                <Icon className="h-2.5 w-2.5" />
                {e.label}
              </div>
            </div>
          </div>
          <div className="relative shrink-0" onClick={(ev) => ev.stopPropagation()}>
            <button
              onClick={() => onAbrirMenu(!menuAbierto)}
              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Cambiar estado"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuAbierto && (
              <div className="absolute right-0 top-8 z-30 w-48 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card shadow-xl overflow-hidden">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/50">
                  Cambiar estado a…
                </div>
                {ESTADOS.map(es => (
                  <button
                    key={es.value}
                    onClick={() => onCambiarEstado(es.value as Producto["estado"])}
                    disabled={es.value === p.estado}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-muted transition disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full", es.dot)}></span>
                    <span className={cn(es.value === p.estado && "font-semibold")}>{es.label}</span>
                    {es.value === p.estado && <span className="ml-auto text-[10px] text-muted-foreground">actual</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fila de meta: responsable, país, plataforma */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {responsable ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center">
                {iniciales(responsable)}
              </span>
              <span className="truncate max-w-[100px]">{responsable}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground/60">
              <UserIcon className="h-3 w-3" /> Sin asignar
            </span>
          )}
          {pais && (
            <span className="inline-flex items-center gap-1">
              <span className="text-sm">{pais.flag}</span>
              <span>{pais.value}</span>
            </span>
          )}
          {p.plataforma && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted">
              {p.plataforma}
            </span>
          )}
        </div>

        {/* Bloque de números: precio, costo, margen */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/40 p-2">
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Costo</div>
            <div className="text-xs font-semibold tabular-nums truncate">
              {p.costo_proveedor ? formatMoney(p.costo_proveedor, moneda) : "—"}
            </div>
          </div>
          <div className="text-center border-x border-border/50">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Precio</div>
            <div className="text-xs font-semibold tabular-nums truncate">
              {p.precio_final ? formatMoney(p.precio_final, moneda) : "—"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Margen</div>
            <div className={cn(
              "text-xs font-bold tabular-nums",
              margen === null ? "text-muted-foreground" :
              margen >= 60 ? "text-emerald-600 dark:text-emerald-400" :
              margen >= 40 ? "text-amber-600 dark:text-amber-400" :
              "text-rose-600 dark:text-rose-400"
            )}>
              {margen !== null ? `${margen}%` : "—"}
            </div>
          </div>
        </div>

        {/* Links + Stock + Acciones */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            {p.link_landing && <LinkIcon2 href={p.link_landing} label="Landing" color="bg-blue-500/15 text-blue-600 dark:text-blue-400" />}
            {p.link_drive && <LinkIcon2 href={p.link_drive} label="Drive" color="bg-amber-500/15 text-amber-600 dark:text-amber-400" />}
            {p.link_creativos && <LinkIcon2 href={p.link_creativos} label="Creativos" color="bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400" />}
            {p.dropi_url && <LinkIcon2 href={dropiHref(p.dropi_url)!} label={dropiLabel(p.dropi_url)} color="bg-orange-500/15 text-orange-600 dark:text-orange-400" />}
            {p.link_referencia && <LinkIcon2 href={p.link_referencia} label="Referencia" color="bg-violet-500/15 text-violet-600 dark:text-violet-400" />}
            {!tieneLinks && (
              <span className="text-[10px] text-muted-foreground/60 italic">Sin links</span>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEditar} title="Editar" className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onBorrar} title="Borrar" className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FILA DE PRODUCTO — layout horizontal full-width tipo lista premium
// ============================================================
function ProductoFila({ p, moneda, responsable, menuAbierto, onAbrirMenu, onEditar, onBorrar, onCambiarEstado }: {
  p: Producto; moneda: string; responsable: string | null;
  menuAbierto: boolean; onAbrirMenu: (open: boolean) => void;
  onEditar: () => void; onBorrar: () => void;
  onCambiarEstado: (n: Producto["estado"]) => void;
}) {
  const e = getEstado(p.estado);
  const Icon = e.icon;
  const pais = PAISES.find(c => c.value === p.pais);
  const margen = calcMargen(p.precio_final, p.costo_proveedor);
  const tieneLinks = !!(p.link_landing || p.link_drive || p.link_creativos || p.dropi_url || p.link_referencia);

  return (
    <div className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all flex items-stretch">
      {/* Banda lateral izquierda con color del estado */}
      <div className={cn("w-1 shrink-0", e.bar)}></div>

      <div className="flex-1 min-w-0 p-3.5 flex flex-col lg:flex-row lg:items-center gap-3 overflow-hidden">

        {/* Foto + nombre + estado */}
        <div className="min-w-0 lg:basis-[22%] lg:max-w-[22%] flex items-start gap-2.5">
          {p.imagen_url && (
            <img src={p.imagen_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-[15px] leading-tight truncate">{p.nombre}</h3>
            <div className={cn("inline-flex items-center gap-1 mt-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded", e.bg, e.text)}>
              <Icon className="h-2.5 w-2.5" />
              {e.label}
            </div>
          </div>
        </div>

        {/* Responsable + país + plataforma */}
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground min-w-0 lg:basis-[24%] lg:max-w-[24%]">
          {responsable ? (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                {iniciales(responsable)}
              </span>
              <span className="truncate">{responsable}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground/60">
              <UserIcon className="h-3 w-3" /> Sin asignar
            </span>
          )}
          {pais && (
            <span className="inline-flex items-center gap-1 shrink-0">
              <span className="text-sm">{pais.flag}</span>
              <span>{pais.value}</span>
            </span>
          )}
          {p.plataforma && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted shrink-0">
              {p.plataforma}
            </span>
          )}
        </div>

        {/* Costo / Precio / Margen */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/40 p-2 lg:basis-[30%] lg:max-w-[30%] min-w-0">
          <div className="text-center min-w-0">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Costo</div>
            <div className="text-xs font-semibold tabular-nums truncate">
              {p.costo_proveedor ? formatMoney(p.costo_proveedor, moneda) : "—"}
            </div>
          </div>
          <div className="text-center border-x border-border/50 min-w-0">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Precio</div>
            <div className="text-xs font-semibold tabular-nums truncate">
              {p.precio_final ? formatMoney(p.precio_final, moneda) : "—"}
            </div>
          </div>
          <div className="text-center min-w-0">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Margen</div>
            <div className={cn(
              "text-xs font-bold tabular-nums",
              margen === null ? "text-muted-foreground" :
              margen >= 60 ? "text-emerald-600 dark:text-emerald-400" :
              margen >= 40 ? "text-amber-600 dark:text-amber-400" :
              "text-rose-600 dark:text-rose-400"
            )}>
              {margen !== null ? `${margen}%` : "—"}
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center gap-1.5 lg:basis-[14%] lg:max-w-[14%] flex-wrap">
          {p.link_landing && <LinkIcon2 href={p.link_landing} label="Land" color="bg-blue-500/15 text-blue-600 dark:text-blue-400" />}
          {p.link_drive && <LinkIcon2 href={p.link_drive} label="Drive" color="bg-amber-500/15 text-amber-600 dark:text-amber-400" />}
          {p.link_creativos && <LinkIcon2 href={p.link_creativos} label="Creat" color="bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400" />}
          {p.dropi_url && <LinkIcon2 href={dropiHref(p.dropi_url)!} label={dropiLabel(p.dropi_url)} color="bg-orange-500/15 text-orange-600 dark:text-orange-400" />}
          {p.link_referencia && <LinkIcon2 href={p.link_referencia} label="Ref." color="bg-violet-500/15 text-violet-600 dark:text-violet-400" />}
          {!tieneLinks && !p.dropi_url && !p.link_referencia && <span className="text-[10px] text-muted-foreground/50 italic">Sin links</span>}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-0.5 shrink-0 ml-auto lg:ml-0">
          <button
            onClick={onEditar}
            title="Editar"
            className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onBorrar}
            title="Borrar"
            className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div className="relative" onClick={(ev) => ev.stopPropagation()}>
            <button
              onClick={() => onAbrirMenu(!menuAbierto)}
              className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Cambiar estado"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuAbierto && (
              <div className="absolute right-0 top-9 z-30 w-48 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card shadow-xl overflow-hidden">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/50">
                  Cambiar estado a…
                </div>
                {ESTADOS.map(es => (
                  <button
                    key={es.value}
                    onClick={() => onCambiarEstado(es.value as Producto["estado"])}
                    disabled={es.value === p.estado}
                    className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-muted transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full", es.dot)}></span>
                    <span className={cn(es.value === p.estado && "font-semibold")}>{es.label}</span>
                    {es.value === p.estado && <span className="ml-auto text-[10px] text-muted-foreground">actual</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkIcon2({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider hover:opacity-80 transition", color)}
    >
      <ExternalLink className="h-2.5 w-2.5" />
      {label}
    </a>
  );
}

// ============================================================
// FORMULARIO EN 5 SECCIONES COLAPSABLES
// ============================================================
function FormularioProducto({ form, setForm, editing, saving, moneda, miembros, onGuardar, onCancelar }: {
  form: FormState;
  setForm: (f: FormState) => void;
  editing: boolean;
  saving: boolean;
  moneda: string;
  miembros: { id: string; nombre: string }[];
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  const [abierto, setAbierto] = useState<Record<string, boolean>>({
    basico: true,
    costos: false,
    recursos: false,
    activaciones: false,
    observaciones: false,
  });

  const toggle = (k: string) => setAbierto(a => ({ ...a, [k]: !a[k] }));

  const margenForm = calcMargen(form.precio_final, form.costo_proveedor);

  return (
    <div className="rounded-xl border border-primary/30 bg-card shadow-lg shadow-primary/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          {editing ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
          <h3 className="font-semibold text-sm">{editing ? "Editar producto" : "Nuevo producto"}</h3>
        </div>
        <button onClick={onCancelar} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
          <Close className="h-4 w-4" />
        </button>
      </div>

      <div className="divide-y divide-border">
        {/* SECCIÓN 1 — BÁSICO */}
        <Section
          icon={<Tag className="h-4 w-4" />}
          label="Información básica"
          open={abierto.basico}
          onToggle={() => toggle("basico")}
          required
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo label="Nombre del producto *">
              <Input
                value={form.nombre ?? ""}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Procesador de alimentos"
                autoFocus
                className="h-10"
              />
            </Campo>
            <Campo label="Proveedor">
              <Input
                value={form.proveedor ?? ""}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                placeholder="Oh Homie, Dropi, etc."
                className="h-10"
              />
            </Campo>
            <Campo label="País">
              <Select
                value={form.pais ?? ""}
                onChange={(v) => setForm({ ...form, pais: v })}
                options={PAISES.map(p => ({ value: p.value, label: `${p.flag} ${p.label}` }))}
              />
            </Campo>
            <Campo label="Responsable">
              <Input
                list="hexzor-miembros-sugeridos"
                value={form.responsable ?? ""}
                onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                placeholder="Escribe un nombre (ej: Valentina, Sebas…)"
                className="h-10"
              />
              <datalist id="hexzor-miembros-sugeridos">
                {miembros.map(m => <option key={m.id} value={m.nombre} />)}
              </datalist>
            </Campo>
            <Campo label="Plataforma">
              <Select
                value={form.plataforma ?? ""}
                onChange={(v) => setForm({ ...form, plataforma: v })}
                options={[
                  { value: "TT", label: "TikTok" },
                  { value: "FB", label: "Facebook" },
                  { value: "TT+FB", label: "TikTok + Facebook" },
                  { value: "Otro", label: "Otro" },
                ]}
              />
            </Campo>
            <Campo label="Estado">
              <Select
                value={form.estado ?? "testeo"}
                onChange={(v) => setForm({ ...form, estado: v as any })}
                options={ESTADOS.map(e => ({ value: e.value, label: e.label }))}
              />
            </Campo>
            <Campo label="Tipo">
              <Select
                value={form.tipo ?? "dropshipping"}
                onChange={(v) => setForm({ ...form, tipo: v })}
                options={[
                  { value: "dropshipping", label: "Dropshipping" },
                  { value: "importacion",  label: "Importación" },
                  { value: "local",        label: "Local" },
                  { value: "otro",         label: "Otro" },
                ]}
              />
            </Campo>
            <Campo label="Stock">
              <Input
                type="number"
                step={1}
                value={form.stock ?? ""}
                onChange={(e) => setForm({ ...form, stock: e.target.value === "" ? null : Number(e.target.value) })}
                className="h-10 tabular-nums"
              />
            </Campo>
            <Campo label="Foto del producto">
              <div className="flex items-center gap-3">
                {form.imagen_url ? (
                  <img src={form.imagen_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted border border-dashed border-border flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const thumb = await comprimirImagen(f);
                      setForm({ ...form, imagen_url: thumb });
                    }}
                    className="block w-full text-xs text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:text-xs file:font-medium hover:file:bg-primary/20 file:cursor-pointer"
                  />
                  {form.imagen_url && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, imagen_url: "" })}
                      className="text-[11px] text-destructive hover:underline mt-1"
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
              </div>
            </Campo>
          </div>
        </Section>

        {/* SECCIÓN 2 — COSTOS */}
        <Section
          icon={<DollarSign className="h-4 w-4" />}
          label="Costos y precios"
          open={abierto.costos}
          onToggle={() => toggle("costos")}
          rightSlot={
            margenForm !== null ? (
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded",
                margenForm >= 60 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                margenForm >= 40 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              )}>
                Margen {margenForm}%
              </span>
            ) : null
          }
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo label={`Costo proveedor (${moneda})`}>
              <Input
                type="number" step={0.01}
                value={form.costo_proveedor ?? ""}
                onChange={(e) => setForm({ ...form, costo_proveedor: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="0.00"
                className="h-10 tabular-nums"
              />
            </Campo>
            <Campo label={`Precio final (${moneda})`}>
              <Input
                type="number" step={0.01}
                value={form.precio_final ?? ""}
                onChange={(e) => setForm({ ...form, precio_final: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="0.00"
                className="h-10 tabular-nums"
              />
            </Campo>
            <Campo label={`Precio 2 und (${moneda})`}>
              <Input
                type="number" step={0.01}
                value={form.precio_2und ?? ""}
                onChange={(e) => setForm({ ...form, precio_2und: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="Combo de 2"
                className="h-10 tabular-nums"
              />
            </Campo>
            <Campo label={`Precio x3 (${moneda})`}>
              <Input
                type="number" step={0.01}
                value={form.precio_x3 ?? ""}
                onChange={(e) => setForm({ ...form, precio_x3: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="Combo de 3"
                className="h-10 tabular-nums"
              />
            </Campo>
          </div>
        </Section>

        {/* SECCIÓN 3 — RECURSOS */}
        <Section
          icon={<LinkIcon className="h-4 w-4" />}
          label="Recursos y links"
          open={abierto.recursos}
          onToggle={() => toggle("recursos")}
        >
          <div className="space-y-3">
            <Campo label="Landing page">
              <Input
                value={form.link_landing ?? ""}
                onChange={(e) => setForm({ ...form, link_landing: e.target.value })}
                placeholder="https://..."
                className="h-10"
              />
            </Campo>
            <Campo label="Drive (info y assets)">
              <Input
                value={form.link_drive ?? ""}
                onChange={(e) => setForm({ ...form, link_drive: e.target.value })}
                placeholder="https://drive.google.com/..."
                className="h-10"
              />
            </Campo>
            <Campo label="Creativos">
              <Input
                value={form.link_creativos ?? ""}
                onChange={(e) => setForm({ ...form, link_creativos: e.target.value })}
                placeholder="https://..."
                className="h-10"
              />
            </Campo>
            <Campo label="Producto en Dropi (link o ID)">
              <Input
                value={form.dropi_url ?? ""}
                onChange={(e) => setForm({ ...form, dropi_url: e.target.value })}
                placeholder="https://app.dropi.co/... o el ID"
                className="h-10"
              />
            </Campo>
            <Campo label="Referencia / competencia (link)">
              <Input
                value={form.link_referencia ?? ""}
                onChange={(e) => setForm({ ...form, link_referencia: e.target.value })}
                placeholder="Link del producto de la competencia o referencia"
                className="h-10"
              />
            </Campo>
          </div>
        </Section>

        {/* SECCIÓN 4 — ACTIVACIONES */}
        <Section
          icon={<CalendarIcon className="h-4 w-4" />}
          label="Fechas de activación"
          open={abierto.activaciones}
          onToggle={() => toggle("activaciones")}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo label="Activación TikTok Ads">
              <Input
                type="date"
                value={form.fecha_activacion_tt ?? ""}
                onChange={(e) => setForm({ ...form, fecha_activacion_tt: e.target.value })}
                className="h-10"
              />
            </Campo>
            <Campo label="Activación Facebook Ads">
              <Input
                type="date"
                value={form.fecha_activacion_fb ?? ""}
                onChange={(e) => setForm({ ...form, fecha_activacion_fb: e.target.value })}
                className="h-10"
              />
            </Campo>
          </div>
        </Section>

        {/* SECCIÓN 5 — OBSERVACIONES */}
        <Section
          icon={<StickyNote className="h-4 w-4" />}
          label="Observaciones y análisis"
          open={abierto.observaciones}
          onToggle={() => toggle("observaciones")}
        >
          <textarea
            rows={4}
            value={form.observacion ?? ""}
            onChange={(e) => setForm({ ...form, observacion: e.target.value })}
            placeholder="Hipótesis de testeo, ángulo principal, público objetivo, recomendaciones, ajustes…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y"
          />
        </Section>
      </div>

      {/* Footer del form */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 bg-muted/30 border-t">
        <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button onClick={onGuardar} disabled={saving} className="shadow-md shadow-primary/20">
          <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando…" : (editing ? "Guardar cambios" : "Crear producto")}
        </Button>
      </div>
    </div>
  );
}

function Section({ icon, label, open, onToggle, children, required, rightSlot }: {
  icon: React.ReactNode; label: string; open: boolean; onToggle: () => void;
  children: React.ReactNode; required?: boolean; rightSlot?: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition text-left"
      >
        <span className="text-primary shrink-0">{icon}</span>
        <span className="text-sm font-medium flex-1">{label}{required && <span className="text-primary ml-1">*</span>}</span>
        {rightSlot}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
