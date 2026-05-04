import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser, isSuperAdmin } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Building2, Receipt, Activity, ArrowLeft } from "lucide-react";
import { LogoutButton } from "@/app/espacios/logout-button";
import { cn } from "@/lib/utils";

type AdminUsuario = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
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

  // Stats globales
  const totalUsuarios = lista.length;
  const activosSemana = lista.filter(u => isActivoSemana(u.ultima_actividad)).length;
  const totalEspacios = lista.reduce((s, u) => s + Number(u.espacios_count), 0);
  const totalTransacciones = lista.reduce((s, u) => s + Number(u.transacciones_count), 0);

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
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" /> Administración
          </h2>
          <p className="text-muted-foreground">Control general de la plataforma. Solo tú ves esto.</p>
        </div>

        {/* KPIs globales */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Usuarios totales" value={totalUsuarios.toString()} icon={<Users />} />
          <KpiCard label="Activos esta semana" value={activosSemana.toString()} icon={<Activity />} highlight={activosSemana > 0} />
          <KpiCard label="Espacios creados" value={totalEspacios.toString()} icon={<Building2 />} />
          <KpiCard label="Transacciones" value={totalTransacciones.toString()} icon={<Receipt />} />
        </div>

        {/* Lista de usuarios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Usuarios registrados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lista.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6">Todavía no hay usuarios registrados.</p>
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
                      <th className="px-4 py-3 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lista.map(u => {
                      const activo = isActivoSemana(u.ultima_actividad);
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
                              activo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                            )}>{activo ? "Activo" : "Inactivo"}</span>
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

        <p className="text-xs text-muted-foreground">
          La actividad se mide por la fecha de su última transacción registrada. Un usuario se considera "activo" si registró algo en los últimos 7 días.
        </p>
      </div>
    </main>
  );
}

function KpiCard({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={cn(highlight && "border-success/40 bg-success/5")}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
            <p className={cn("text-3xl font-bold tabular-nums mt-1", highlight && "text-success")}>{value}</p>
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
