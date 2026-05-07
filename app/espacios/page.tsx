import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getMisEspacios, getCurrentUser, isSuperAdmin, getEstadoCuenta } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, User, Lock, Plus, BookOpen, Shield, Sparkles, ArrowRight } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { TourBienvenida } from "@/components/tour-bienvenida";
import { EspacioCardCliente } from "./espacio-card";
import type { Espacio } from "@/lib/types";

type EspacioConRol = Espacio & { _esOwner: boolean };

export default async function EspaciosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const estado = await getEstadoCuenta();
  if (estado === "pendiente" || estado === "rechazado") redirect("/esperando-aprobacion");

  const supabase = createClient();
  const { data: perfil } = await supabase.from("perfiles")
    .select("nombre, tour_completado").eq("id", user.id).maybeSingle();
  const tourPendiente = perfil?.tour_completado === false;

  const espaciosBase = await getMisEspacios();

  // Cargar el rol del usuario en cada espacio para saber si puede eliminarlo
  const { data: misRoles } = await supabase
    .from("espacio_miembros")
    .select("espacio_id, rol")
    .eq("perfil_id", user.id);
  const rolPorEspacio: Record<string, string> = {};
  for (const m of misRoles ?? []) rolPorEspacio[m.espacio_id] = m.rol;

  const espacios: EspacioConRol[] = espaciosBase.map((e) => ({
    ...e,
    _esOwner: rolPorEspacio[e.id] === "owner",
  }));
  const empresariales = espacios.filter((e) => e.tipo === "empresarial");
  const personales = espacios.filter((e) => e.tipo === "personal");
  const esAdmin = await isSuperAdmin();
  const sinEspacios = espacios.length === 0;
  const primerNombre = (perfil?.nombre ?? user.email ?? "").split(" ")[0];

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      {tourPendiente && <TourBienvenida nombreUsuario={perfil?.nombre ?? user.email ?? ""} />}

      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Image src="/icon.jpg" alt="Hexzor" width={32} height={32} priority className="rounded-lg" />
            <div>
              <h1 className="font-bold tracking-tight leading-none">Hexzor</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild size="sm" variant="ghost">
              <Link href="/guia">
                <BookOpen className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Guía</span>
              </Link>
            </Button>
            {esAdmin && (
              <Button asChild size="sm" variant="ghost" className="text-primary">
                <Link href="/admin">
                  <Shield className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              </Button>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Saludo */}
        <div className="space-y-1">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Hola{primerNombre ? `, ${primerNombre}` : ""} 👋
          </h2>
          <p className="text-muted-foreground">
            {sinEspacios
              ? "Aún no tienes espacios — crea el primero para arrancar."
              : "Elige un espacio para entrar o crea uno nuevo."}
          </p>
        </div>

        {/* Estado vacío grande */}
        {sinEspacios && (
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardContent className="py-10 text-center space-y-4">
              <div className="mx-auto w-fit p-4 rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-semibold">¡Bienvenido a Hexzor!</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Crea tu primer espacio: <b>Empresarial</b> para tu negocio o <b>Personal</b> para tu vida.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button asChild size="lg">
                  <Link href="/espacios/nuevo">
                    <Plus className="h-4 w-4 mr-2" /> Crear mi primer espacio
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/guia">
                    <BookOpen className="h-4 w-4 mr-2" /> ¿Cómo funciona?
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empresarial */}
        {!sinEspacios && (
          <SectionEspacios
            tipo="empresarial"
            titulo="Empresarial"
            subtitulo="Para tu negocio"
            icon={<Building2 className="h-5 w-5" />}
            espacios={empresariales}
            esSuperAdmin={esAdmin}
          />
        )}

        {/* Personal */}
        {!sinEspacios && (
          <SectionEspacios
            tipo="personal"
            titulo="Personal"
            subtitulo="Privado · puedes proteger con PIN"
            icon={<User className="h-5 w-5" />}
            espacios={personales}
            esSuperAdmin={esAdmin}
          />
        )}
      </div>
    </main>
  );
}

function SectionEspacios({
  tipo, titulo, subtitulo, icon, espacios, esSuperAdmin,
}: {
  tipo: "empresarial" | "personal";
  titulo: string;
  subtitulo: string;
  icon: React.ReactNode;
  espacios: EspacioConRol[];
  esSuperAdmin?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <span className="text-primary">{icon}</span> {titulo}
          </h3>
          <p className="text-xs text-muted-foreground">{subtitulo}</p>
        </div>
        <Button asChild size="sm" variant="ghost" className="text-primary">
          <Link href={`/espacios/nuevo?tipo=${tipo}`}>
            <Plus className="h-4 w-4 mr-1" /> Crear nuevo
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {espacios.map((e) => (
          <EspacioCardCliente
            key={e.id}
            espacio={e}
            tipo={tipo}
            esOwner={e._esOwner || !!esSuperAdmin}
          />
        ))}

        {espacios.length === 0 && (
          <Card className="border-dashed col-span-full">
            <CardContent className="py-6 text-center text-sm text-muted-foreground space-y-2">
              <p>No tienes espacios {tipo}es todavía.</p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/espacios/nuevo?tipo=${tipo}`}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Crear {tipo}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
