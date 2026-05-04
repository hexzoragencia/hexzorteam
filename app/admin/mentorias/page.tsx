import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser, isSuperAdmin } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, ArrowLeft, ArrowRight, Calendar, User as UserIcon, Pause, CheckCircle2, XCircle } from "lucide-react";
import { LogoutButton } from "@/app/espacios/logout-button";
import { cn } from "@/lib/utils";

type EstudianteStats = {
  id: string;
  nombre: string;
  contacto: string | null;
  tipo: "mentoria" | "asesoria";
  nivel: string | null;
  estado: "activo" | "pausado" | "graduado" | "abandonado";
  fecha_inicio: string | null;
  clases_total: number;
  clases_vistas: number;
  clases_pendientes: number;
  proxima_fecha: string | null;
  proxima_titulo: string | null;
};

const ESTADO_ICON: Record<string, React.ReactNode> = {
  activo: <CheckCircle2 className="h-3.5 w-3.5" />,
  pausado: <Pause className="h-3.5 w-3.5" />,
  graduado: <GraduationCap className="h-3.5 w-3.5" />,
  abandonado: <XCircle className="h-3.5 w-3.5" />,
};

const ESTADO_COLOR: Record<string, string> = {
  activo: "bg-success/15 text-success",
  pausado: "bg-warning/15 text-warning",
  graduado: "bg-primary/15 text-primary",
  abandonado: "bg-muted text-muted-foreground",
};

function formatFechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

export default async function MentoriasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const esAdmin = await isSuperAdmin();
  if (!esAdmin) redirect("/espacios");

  const supabase = createClient();
  const { data: estudiantes } = await supabase
    .from("mentorias_estudiantes_stats")
    .select("*")
    .order("estado", { ascending: true })
    .order("created_at", { ascending: false });

  const lista = (estudiantes ?? []) as EstudianteStats[];
  const activos = lista.filter(e => e.estado === "activo");
  const pausados = lista.filter(e => e.estado === "pausado");
  const graduados = lista.filter(e => e.estado === "graduado");
  const abandonados = lista.filter(e => e.estado === "abandonado");

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/icon.jpg" alt="Hexzor" width={36} height={36} priority className="rounded-lg" />
            <div>
              <h1 className="font-bold tracking-tight flex items-center gap-2">
                Mentorías <GraduationCap className="h-4 w-4 text-primary" />
              </h1>
              <p className="text-xs text-muted-foreground">Estudiantes que asesoras</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Volver al admin
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <GraduationCap className="h-7 w-7 text-primary" /> Tus estudiantes
            </h2>
            <p className="text-muted-foreground">Lleva el control del avance de cada uno.</p>
          </div>
          <Button asChild>
            <Link href="/admin/mentorias/nuevo"><Plus className="h-4 w-4 mr-1" /> Nuevo estudiante</Link>
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Activos" value={activos.length} color="success" icon={<CheckCircle2 />} />
          <KpiCard label="Pausados" value={pausados.length} color="warning" icon={<Pause />} />
          <KpiCard label="Graduados" value={graduados.length} color="primary" icon={<GraduationCap />} />
          <KpiCard label="Abandonados" value={abandonados.length} color="muted" icon={<XCircle />} />
        </div>

        {/* Lista de estudiantes activos */}
        {activos.length > 0 && <ListaSection titulo="Activos" estudiantes={activos} />}
        {pausados.length > 0 && <ListaSection titulo="Pausados" estudiantes={pausados} muted />}
        {graduados.length > 0 && <ListaSection titulo="Graduados" estudiantes={graduados} muted />}
        {abandonados.length > 0 && <ListaSection titulo="Abandonados" estudiantes={abandonados} muted />}

        {lista.length === 0 && (
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardContent className="py-10 text-center space-y-3">
              <div className="mx-auto w-fit p-3 rounded-full bg-primary/15 text-primary">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="font-semibold">Aún no tienes estudiantes</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Crea el primero para empezar a llevar el seguimiento de sus clases.
              </p>
              <Button asChild>
                <Link href="/admin/mentorias/nuevo"><Plus className="h-4 w-4 mr-1" /> Agregar estudiante</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function ListaSection({ titulo, estudiantes, muted }: { titulo: string; estudiantes: EstudianteStats[]; muted?: boolean }) {
  return (
    <Card className={cn(muted && "opacity-90")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {titulo} <span className="text-xs text-muted-foreground font-normal">({estudiantes.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {estudiantes.map(e => {
            const pct = e.clases_total > 0 ? (Number(e.clases_vistas) / Number(e.clases_total)) * 100 : 0;
            return (
              <li key={e.id}>
                <Link href={`/admin/mentorias/${e.id}`} className="block px-4 py-3 hover:bg-muted/30 transition group">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full p-2.5 bg-primary/10 text-primary shrink-0">
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center">
                      <div className="sm:col-span-4 min-w-0">
                        <div className="font-medium truncate">{e.nombre}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {e.tipo === "mentoria" ? "Mentoría" : "Asesoría"}
                          {e.nivel && ` · ${e.nivel}`}
                          {e.contacto && ` · ${e.contacto}`}
                        </div>
                      </div>
                      <div className="sm:col-span-3">
                        <div className="text-xs text-muted-foreground mb-1">Progreso</div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs tabular-nums shrink-0">{e.clases_vistas}/{e.clases_total}</span>
                        </div>
                      </div>
                      <div className="sm:col-span-3">
                        <div className="text-xs text-muted-foreground mb-1">Próxima clase</div>
                        <div className="text-sm flex items-center gap-1.5">
                          {e.proxima_fecha ? (
                            <>
                              <Calendar className="h-3.5 w-3.5 text-primary" />
                              <span className="truncate">{formatFechaCorta(e.proxima_fecha)} · {e.proxima_titulo}</span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">— sin agendar</span>
                          )}
                        </div>
                      </div>
                      <div className="sm:col-span-2 flex items-center justify-end gap-2">
                        <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1", ESTADO_COLOR[e.estado])}>
                          {ESTADO_ICON[e.estado]} {e.estado}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition" />
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function KpiCard({ label, value, color, icon }: {
  label: string; value: number; color: "success" | "warning" | "primary" | "muted"; icon: React.ReactNode;
}) {
  const colorMap = {
    success: { border: "border-success/40 bg-success/5", text: "text-success" },
    warning: { border: "border-warning/40 bg-warning/5", text: "text-warning" },
    primary: { border: "border-primary/40 bg-primary/5", text: "text-primary" },
    muted: { border: "", text: "text-muted-foreground" },
  };
  const c = colorMap[color];
  return (
    <Card className={cn(value > 0 && c.border)}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
            <p className={cn("text-3xl font-bold tabular-nums mt-1", value > 0 && c.text)}>{value}</p>
          </div>
          <div className={cn("text-muted-foreground", value > 0 && c.text)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
