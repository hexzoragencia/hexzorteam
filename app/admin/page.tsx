import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser, isSuperAdmin } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Building2, Receipt, Activity, ArrowLeft, Clock, Check, X, UserCheck, GraduationCap } from "lucide-react";
import { LogoutButton } from "@/app/espacios/logout-button";
import { cn } from "@/lib/utils";
import { aprobarUsuario, rechazarUsuario } from "./actions";

type AdminUsuario = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  estado: "pendiente" | "activo" | "rechazado";
  registrado_at: string;
  espacios_count: number;
  transacciones_count: number;
  ultima_actividad: string | null;
};

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function relativeFromNow(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffD = Math.floor(diffH / 24);
  if (diffH < 1) return "Hace minutos";
  if (diffH < 24) return `Hace ${diffH}h`;
  if (diffD < 7) return `Hace ${diffD}d`;
  if (diffD < 30) return `Hace ${Math.floor(diffD / 7)}sem`;
  return formatFecha(iso);
}

function isActivoSemana(iso: string | null): boolean {
  if (!iso) return false;
  const diffD = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
  return diffD <= 7;
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const esAdmin = await isSuperAdmin();
  if (!esAdmin) redirect("/espacios");

  const supabase = createClient();
  const { data: usuarios } = await supabase
    .from("admin_usuarios")
    .select("*")
    .order("registrado_at", { ascending: false });

  const lista = (usuarios ?? []) as AdminUsuario[];
  const pendientes = lista.filter(u => u.estado === "pendiente");
  const activos = lista.filter(u => u.estado === "activo");
  const rechazados = lista.filter(u => u.estado === "rechazado");

  // Stats globales
  const totalUsuarios = activos.length;
  const activosSemana = activos.filter(u => isActivoSemana(u.ultima_actividad)).length;
  const totalEspacios = activos.reduce((s, u) => s + Number(u.espacios_count), 0);
  const totalTransacciones = activos.reduce((s, u) => s + Number(u.transacciones_count), 0);

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/icon.jpg" alt="Hexzor" width={36} height={36} priority />
            <div>
              <h1 className="font-bold tracking-tight flex items-center gap-2">
                Hexzor <Shield className="h-4 w-4 text-primary" />
              </h1>
              <p className="text-xs text-muted-foreground">Panel de administración</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/espacios" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Volver a espacios
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-7 w-7 text-primary" /> Administración
            </h2>
            <p className="text-muted-foreground">Control general de la plataforma. Solo tú ves esto.</p>
          </div>
          <Link
            href="/admin/mentorias"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium text-sm transition"
          >
            <GraduationCap className="h-4 w-4" /> Mentorías y asesorías
          </Link>
        </div>

        {/* KPIs globales */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Usuarios activos" value={totalUsuarios.toString()} icon={<UserCheck />} />
          <KpiCard label="Pendientes" value={pendientes.length.toString()} icon={<Clock />} highlight={pendientes.length > 0} highlightColor="warning" />
          <KpiCard label="Activos esta semana" value={activosSemana.toString()} icon={<Activity />} highlight={activosSemana > 0} />
          <KpiCard label="Espacios creados" value={totalEspacios.toString()} icon={<Building2 />} />
        </div>

        {/* Pendientes de aprobación — destacado arriba */}
        {pendientes.length > 0 && (
          <Card className="border-warning/40 bg-warning/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <Clock className="h-5 w-5" /> Pendientes de aprobación ({pendientes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {pendientes.map(u => (
                  <li key={u.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{u.nombre}</div>
                      <div className="text-xs text-muted-foreground">{u.email} · solicitado {relativeFromNow(u.registrado_at)}</div>
                    </div>
                    <div className="flex gap-2">
                      <form action={aprobarUsuario}>
                        <input type="hidden" name="target_id" value={u.id} />
                        <button type="submit" className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md bg-success text-white hover:bg-success/90 transition">
                          <Check className="h-3.5 w-3.5" /> Aprobar
                        </button>
                      </form>
                      <form action={rechazarUsuario}>
                        <input type="hidden" name="target_id" value={u.id} />
                        <button type="submit" className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition">
                          <X className="h-3.5 w-3.5" /> Rechazar
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Lista de usuarios activos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Usuarios activos ({activos.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activos.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6">Todavía no hay usuarios activos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Usuario</th>
                      <th className="px-4 py-3 text-left">Rol</th>
                      <th className="px-4 py-3 text-right">Espacios</th>
                      <th className="px-4 py-3 text-right">Transacciones</th>
                      <th className="px-4 py-3 text-left">Registro</th>
                      <th className="px-4 py-3 text-left">Última actividad</th>
                      <th className="px-4 py-3 text-left">Actividad reciente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activos.map(u => {
                      const activoSem = isActivoSemana(u.ultima_actividad);
                      const esYo = u.id === user.id;
                      return (
                        <tr key={u.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-medium flex items-center gap-2">
                              {u.nombre}
                              {esYo && <span className="text-[10px] uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded">Tú</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded font-medium",
                              u.rol === "superadmin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                            )}>{u.rol}</span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{u.espacios_count}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{u.transacciones_count}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{formatFecha(u.registrado_at)}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{relativeFromNow(u.ultima_actividad)}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded font-medium",
                              activoSem ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                            )}>{activoSem ? "Activo" : "Inactivo"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rechazados (si hay) */}
        {rechazados.length > 0 && (
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-muted-foreground text-base">
                <X className="h-4 w-4" /> Rechazados ({rechazados.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {rechazados.map(u => (
                  <li key={u.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm">{u.nombre}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <form action={aprobarUsuario}>
                      <input type="hidden" name="target_id" value={u.id} />
                      <button type="submit" className="text-xs text-primary hover:underline">Reactivar</button>
                    </form>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          La actividad se mide por la fecha de su última transacción. Un usuario se considera "activo" si registró algo en los últimos 7 días.
          Aprobar a un usuario crea automáticamente sus dos espacios (Empresa · Personal).
        </p>
      </div>
    </main>
  );
}

function KpiCard({ label, value, icon, highlight, highlightColor }: {
  label: string; value: string; icon: React.ReactNode; highlight?: boolean; highlightColor?: "success" | "warning";
}) {
  const color = highlightColor ?? "success";
  return (
    <Card className={cn(
      highlight && color === "success" && "border-success/40 bg-success/5",
      highlight && color === "warning" && "border-warning/50 bg-warning/5",
    )}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
            <p className={cn(
              "text-3xl font-bold tabular-nums mt-1",
              highlight && color === "success" && "text-success",
              highlight && color === "warning" && "text-warning",
            )}>{value}</p>
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
