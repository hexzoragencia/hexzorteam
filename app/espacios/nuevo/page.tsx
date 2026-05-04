import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/espacio";
import { NuevoEspacioForm } from "./form";

export default async function NuevoEspacioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Image src="/icon.jpg" alt="Hexzor" width={32} height={32} />
          <span className="font-bold tracking-tight">Hexzor</span>
          <Link href="/espacios" className="ml-auto text-sm underline">← Volver</Link>
        </div>
      </header>
      <div className="max-w-2xl mx-auto p-6">
        <NuevoEspacioForm />
      </div>
    </main>
  );
}
