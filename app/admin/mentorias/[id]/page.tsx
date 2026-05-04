import Link from "next/link";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isSuperAdmin } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GraduationCap, ArrowLeft, Plus, Calendar, Clock, Check, Trash2, RotateCcw,
  Edit2, User as UserIcon, Save,
} from "lucide-react";
import {
  actualizarEstudiante, eliminarEstudiante, crearClase,
  marcarClaseVista, reabrirClase, eliminarClase, actualizarClase,
} from "../actions";
import { cn } from "@/lib/utils";

type Estudiante = {
  id: string;
  nombre: string;
  contacto: string | null;
  tipo: "mentoria" | "asesoria";
  nivel: string | null;
  estado: "activo" | "pausado" | "graduado" | "abandonado";
  notas: string | null;
  fecha_inicio: string | null;
};

type Clase = {
  id: string;
  estudiante_id: string;
  numero_orden: number;
  titulo: string;
  descripcion: string | null;
  fecha: string | null;
  hora: string | null;
  duracion_min: number | null;
  estado: "pendiente" | "vista" | "cancelada";
  fecha_completada: string | null;
  notas: string | null;
};

function formatHora(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

function formatFecha(iso: string | null): string {
  if (!iso) return "Sin agendar";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

const HOY = new Date().toISOString().slice(0, 10);

export default async function EstudianteDetallePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await isSuperAdmin())) redirect("/espacios");

  const supabase = createClient();
  const { data: est } = await supabase
    .from("mentorias_estudiantes").select("*").eq("id", params.id).maybeSingle();
  if (!est) notFound();
  const estudiante = est as Estudiante;

  const { data: clasesData } = await supabase
    .from("mentorias_clases").select("*")
    .eq("estudiante_id", params.id)
    .order("numero_orden", { ascending: true });
  const clases = (clasesData ?? []) as Clase[];

  const proximas = clases.filter(c => c.estado === "pendiente" && c.fecha && c.fecha >= HOY);
  const hoy = clases.filter(c => c.estado === "pendiente" && c.fecha === HOY);
  const sinAgendar = clases.filter(c => c.estado === "pendiente" && !c.fecha);
  const atrasadas = clases.filter(c => c.estado === "pendiente" && c.fecha && c.fecha < HOY);
  const completadas = clases.filter(c => c.estado === "vista");

  const totalProgreso = clases.length > 0 ? (completadas.length / clases.length) * 100 : 0;

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Image src="/icon.jpg" alt="Hexzor" width={32} height={32} className="rounded-lg" />
          <span className="font-bold tracking-tight">Hexzor · Mentorías</span>
          <Link href="/admin/mentorias" className="ml-auto text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Todos los estudiantes
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header del estudiante */}
        <div className="flex items-start gap-4 flex-wrap">
          <div className="rounded-full p-4 bg-primary/15 text-primary">
            <UserIcon className="h-8 w-8" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">{estudiante.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              {estudiante.tipo === "mentoria" ? "Mentoría" : "Asesoría"}
              {estudiante.nivel && ` · ${estudiante.nivel}`}
              {estudiante.contacto && ` · ${estudiante.contacto}`}
            </p>
          </div>
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full",
            estudiante.estado === "activo" && "bg-success/15 text-success",
            estudiante.estado === "pausado" && "bg-warning/15 text-warning",
            estudiante.estado === "graduado" && "bg-primary/15 text-primary",
            estudiante.estado === "abandonado" && "bg-muted text-muted-foreground",
          )}>{estudiante.estado}</span>
        </div>

        {/* Progreso */}
        <Card>
          <CardContent className="pt-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progreso global</span>
              <span className="text-sm tabular-nums">{completadas.length} de {clases.length} clases · {totalProgreso.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${totalProgreso}%` }} />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
              <span>📅 Hoy: {hoy.length}</span>
              <span>⏭️ Próximas: {proximas.length - hoy.length}</span>
              <span>⚠️ Atrasadas: {atrasadas.length}</span>
              <span>📋 Sin agendar: {sinAgendar.length}</span>
              <span>✅ Completadas: {completadas.length}</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Columna izquierda: clases */}
          <div className="lg:col-span-2 space-y-6">
            {/* Atrasadas */}
            {atrasadas.length > 0 && (
              <ClasesSection titulo="⚠️ Atrasadas" clases={atrasadas} estudianteId={estudiante.id} highlight="destructive" />
            )}
            {/* Hoy */}
            {hoy.length > 0 && (
              <ClasesSection titulo="📅 Hoy" clases={hoy} estudianteId={estudiante.id} highlight="primary" />
            )}
            {/* Próximas */}
            {proximas.length - hoy.length > 0 && (
              <ClasesSection titulo="⏭️ Próximas" clases={proximas.filter(c => c.fecha !== HOY)} estudianteId={estudiante.id} />
            )}
            {/* Sin agendar */}
            {sinAgendar.length > 0 && (
              <ClasesSection titulo="📋 Por agendar" clases={sinAgendar} estudianteId={estudiante.id} />
            )}
            {/* Agregar nueva */}
            <NuevaClaseForm estudianteId={estudiante.id} />
            {/* Completadas */}
            {completadas.length > 0 && (
              <ClasesSection titulo="✅ Completadas" clases={completadas} estudianteId={estudiante.id} muted />
            )}
            {clases.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Aún no tiene clases programadas. Agrega la primera arriba.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Columna derecha: editar estudiante */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Edit2 className="h-4 w-4" /> Datos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={actualizarEstudiante} className="space-y-3 text-sm">
                  <input type="hidden" name="id" value={estudiante.id} />
                  <Field label="Nombre" name="nombre" defaultValue={estudiante.nombre} required />
                  <Field label="Contacto" name="contacto" defaultValue={estudiante.contacto ?? ""} />
                  <div className="space-y-1.5">
                    <Label htmlFor="tipo">Tipo</Label>
                    <select id="tipo" name="tipo" defaultValue={estudiante.tipo} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
                      <option value="mentoria">Mentoría</option>
                      <option value="asesoria">Asesoría</option>
                    </select>
                  </div>
                  <Field label="Nivel" name="nivel" defaultValue={estudiante.nivel ?? ""} placeholder="Principiante..." />
                  <div className="space-y-1.5">
                    <Label htmlFor="estado">Estado</Label>
                    <select id="estado" name="estado" defaultValue={estudiante.estado} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
                      <option value="activo">Activo</option>
                      <option value="pausado">Pausado</option>
                      <option value="graduado">Graduado</option>
                      <option value="abandonado">Abandonado</option>
                    </select>
                  </div>
                  <Field label="Fecha inicio" name="fecha_inicio" type="date" defaultValue={estudiante.fecha_inicio ?? ""} />
                  <div className="space-y-1.5">
                    <Label htmlFor="notas">Notas privadas</Label>
                    <textarea id="notas" name="notas" rows={4} defaultValue={estudiante.notas ?? ""}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                  </div>
                  <Button type="submit" size="sm" className="w-full">
                    <Save className="h-3.5 w-3.5 mr-1" /> Guardar cambios
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Eliminar */}
            <Card className="border-destructive/30">
              <CardContent className="pt-5">
                <form action={eliminarEstudiante}>
                  <input type="hidden" name="id" value={estudiante.id} />
                  <p className="text-xs text-muted-foreground mb-2">Esto borra al estudiante y todas sus clases.</p>
                  <button type="submit" className="text-xs text-destructive hover:underline flex items-center gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar estudiante
                  </button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, name, defaultValue, type = "text", required, placeholder }: {
  label: string; name: string; defaultValue: string; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}{required && " *"}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} />
    </div>
  );
}

function ClasesSection({ titulo, clases, estudianteId, highlight, muted }: {
  titulo: string; clases: Clase[]; estudianteId: string;
  highlight?: "primary" | "destructive"; muted?: boolean;
}) {
  return (
    <Card className={cn(
      highlight === "primary" && "border-primary/40 bg-primary/5",
      highlight === "destructive" && "border-destructive/40 bg-destructive/5",
      muted && "opacity-90",
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo} <span className="text-xs text-muted-foreground font-normal">({clases.length})</span></CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {clases.map(c => <ClaseRow key={c.id} clase={c} estudianteId={estudianteId} />)}
        </ul>
      </CardContent>
    </Card>
  );
}

function ClaseRow({ clase, estudianteId }: { clase: Clase; estudianteId: string }) {
  const isVista = clase.estado === "vista";
  return (
    <li className="px-4 py-3">
      <details className="group">
        <summary className="flex items-start gap-3 cursor-pointer list-none">
          <span className={cn(
            "shrink-0 w-7 h-7 rounded-full grid place-items-center text-xs font-semibold",
            isVista ? "bg-success/15 text-success" : "bg-primary/10 text-primary"
          )}>
            {isVista ? <Check className="h-3.5 w-3.5" /> : clase.numero_orden}
          </span>
          <div className="flex-1 min-w-0">
            <div className={cn("font-medium text-sm flex items-center gap-2", isVista && "line-through text-muted-foreground")}>
              <span className="truncate">{clase.titulo}</span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
              {clase.fecha ? (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {formatFecha(clase.fecha)}
                  {clase.hora && <><Clock className="h-3 w-3 ml-1" /> {formatHora(clase.hora)}</>}
                  {clase.duracion_min && ` · ${clase.duracion_min}min`}
                </span>
              ) : (
                <span className="italic">Sin agendar</span>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {!isVista ? (
              <form action={marcarClaseVista}>
                <input type="hidden" name="id" value={clase.id} />
                <input type="hidden" name="estudiante_id" value={estudianteId} />
                <button type="submit" className="text-xs px-2 py-1 rounded-md bg-success text-white hover:bg-success/90 inline-flex items-center gap-1">
                  <Check className="h-3 w-3" /> Vista
                </button>
              </form>
            ) : (
              <form action={reabrirClase}>
                <input type="hidden" name="id" value={clase.id} />
                <input type="hidden" name="estudiante_id" value={estudianteId} />
                <button type="submit" className="text-xs px-2 py-1 rounded-md text-muted-foreground hover:bg-muted inline-flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> Reabrir
                </button>
              </form>
            )}
          </div>
        </summary>
        {/* Editar clase */}
        <form action={actualizarClase} className="mt-3 space-y-2 text-sm pl-10">
          <input type="hidden" name="id" value={clase.id} />
          <input type="hidden" name="estudiante_id" value={estudianteId} />
          <Input name="titulo" defaultValue={clase.titulo} placeholder="Título" />
          <textarea name="descripcion" defaultValue={clase.descripcion ?? ""} placeholder="¿Qué se va a ver en esta clase?" rows={2}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <Input name="fecha" type="date" defaultValue={clase.fecha ?? ""} />
            <Input name="hora" type="time" defaultValue={clase.hora ?? ""} />
            <Input name="duracion_min" type="number" defaultValue={String(clase.duracion_min ?? 60)} min="15" max="480" />
          </div>
          <textarea name="notas" defaultValue={clase.notas ?? ""} placeholder="Notas (lo que se vio, observaciones...)" rows={2}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <Button type="submit" size="sm">Guardar</Button>
            <form action={eliminarClase}>
              <input type="hidden" name="id" value={clase.id} />
              <input type="hidden" name="estudiante_id" value={estudianteId} />
              <button type="submit" className="text-xs text-destructive hover:underline px-2 py-1 inline-flex items-center gap-1">
                <Trash2 className="h-3 w-3" /> Eliminar
              </button>
            </form>
          </div>
        </form>
      </details>
    </li>
  );
}

function NuevaClaseForm({ estudianteId }: { estudianteId: string }) {
  return (
    <Card className="border-dashed border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Agregar clase</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={crearClase} className="space-y-2 text-sm">
          <input type="hidden" name="estudiante_id" value={estudianteId} />
          <Input name="titulo" placeholder="Título de la clase (ej: Mindset, Producto ganador, Pauta...)" required />
          <textarea name="descripcion" placeholder="¿Qué se va a ver?" rows={2}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <Input name="fecha" type="date" />
            <Input name="hora" type="time" />
            <Input name="duracion_min" type="number" defaultValue="60" min="15" max="480" />
          </div>
          <Button type="submit" size="sm">Crear clase</Button>
        </form>
      </CardContent>
    </Card>
  );
}
