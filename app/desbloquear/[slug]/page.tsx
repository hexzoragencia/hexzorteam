import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUser, getEspacioBySlug, PIN_COOKIE } from "@/lib/espacio";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { PinForm } from "./pin-form";

export default async function DesbloquearPage({ params }: { params: { slug: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const espacio = await getEspacioBySlug(params.slug);
  if (!espacio) redirect("/espacios");
  if (espacio.tipo !== "personal" || !espacio.pin_hash) {
    redirect(`/e/${espacio.slug}/dashboard`);
  }

  const unlocked = cookies().get(PIN_COOKIE(espacio.id));
  if (unlocked) redirect(`/e/${espacio.slug}/dashboard`);

  return (
    <main className="min-h-screen grid place-items-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image src="/icon.svg" alt="Hexzor" width={56} height={56} priority />
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{espacio.nombre}</CardTitle>
            <CardDescription>Espacio personal · ingresa tu PIN para entrar</CardDescription>
          </CardHeader>
          <CardContent>
            <PinForm espacioId={espacio.id} slug={espacio.slug} />
            <div className="mt-4 text-center">
              <Link href="/espacios" className="text-xs text-muted-foreground underline">← Volver a espacios</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
