import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getEstadoCuenta } from "@/lib/espacio";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/app/espacios/logout-button";
import { Hourglass, XCircle } from "lucide-react";

export default async function EsperandoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const estado = await getEstadoCuenta();
  if (estado === "activo") redirect("/espacios");

  const rechazado = estado === "rechazado";

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image src="/icon.jpg" alt="Hexzor" width={64} height={64} priority />
          <h1 className="text-2xl font-bold tracking-tight">Hexzor</h1>
        </div>
        <Card>
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto rounded-full p-3 w-fit bg-primary/10">
              {rechazado
                ? <XCircle className="h-8 w-8 text-destructive" />
                : <Hourglass className="h-8 w-8 text-primary" />}
            </div>
            <CardTitle>{rechazado ? "Solicitud rechazada" : "Esperando aprobación"}</CardTitle>
            <CardDescription>
              {rechazado
                ? "Tu solicitud de acceso a Hexzor no fue aprobada. Si crees que es un error, contacta al administrador."
                : "Tu cuenta fue creada correctamente, pero el administrador todavía no la ha aprobado. En cuanto la habilite podrás entrar."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-2 text-center">
              <p>Cuenta: <b>{user.email}</b></p>
            </div>
            <div className="flex justify-center pt-2">
              <LogoutButton />
            </div>
            <p className="text-xs text-muted-foreground text-center pt-2">
              ¿Ya te aprobaron? <Link href="/login" className="underline text-primary">Vuelve a entrar</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
