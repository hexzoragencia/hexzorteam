import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getMisEspacios, getCurrentUser, isSuperAdmin } from "@/lib/espacio";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, User, Lock, Plus, BookOpen, Shield } from "lucide-react";
import { LogoutButton } from "./logout-button";

export default async function EspaciosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const espacios = await getMisEspacios();
  const empresariales = espacios.filter((e) => e.tipo === "empresarial");
  const personales = espacios.filter((e) => e.tipo === "personal");
  const esAdmin = await isSuperAdmin();

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/icon.jpg" alt="Hexzor" width={36} height={36} priority />
            <div>
              <h1 className="font-bold tracking-tight">Hexzor</h1>
              <p className="text-xs text-muted-foreground">Empresarial</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button asChild size="sm" variant="ghost">
              <Link href="/guia"><BookOpen className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Guía</span></Link>
            </Button>
            {esAdmin && (
              <Button asChild size="sm" variant="ghost" className="text-primary">
                <Link href="/admin"><Shield className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Admin</span></Link>
              </Button>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Tus espacios</h2>
            <p className="text-muted-foreground">Selecciona un espacio para entrar o crea uno nuevo.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/guia"><BookOpen className="h-4 w-4 mr-1" /> ¿Cómo funciona?</Link>
          </Button>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Building2 className="h-5 w-5" /> Empresarial</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {empresariales.map((e) => (
              <Link key={e.id} href={`/e/${e.slug}/dashboard`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" /> {e.nombre}
                    </CardTitle>
                    <CardDescription>Empresarial · {e.moneda}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
            {empresariales.length === 0 && (
              <p className="text-sm text-muted-foreground">No tienes espacios empresariales todavía.</p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2"><User className="h-5 w-5" /> Personal <span className="text-xs text-muted-foreground font-normal">(privado · con PIN)</span></h3>
            <Button asChild size="sm" variant="outline"><Link href="/espacios/nuevo"><Plus className="h-4 w-4 mr-1" /> Crear personal</Link></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {personales.map((e) => (
              <Link key={e.id} href={`/e/${e.slug}/dashboard`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" /> {e.nombre}
                      {e.pin_hash && <Lock className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
                    </CardTitle>
                    <CardDescription>Personal · {e.moneda}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
            {personales.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                  Aún no tienes espacio personal. <Link href="/espacios/nuevo" className="underline text-primary">Crea uno</Link> para gestionar tus finanzas privadas.
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
