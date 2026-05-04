import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser, isSuperAdmin } from "@/lib/espacio";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { crearEstudiante } from "../actions";

export default async function NuevoEstudiantePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await isSuperAdmin())) redirect("/espacios");

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Image src="/icon.jpg" alt="Hexzor" width={32} height={32} className="rounded-lg" />
          <span className="font-bold tracking-tight">Hexzor · Mentorías</span>
          <Link href="/admin/mentorias" className="ml-auto text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" /> Nuevo estudiante
            </CardTitle>
            <CardDescription>Vas a poder agregar las clases después, en su detalle.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={crearEstudiante} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre completo *</Label>
                <Input id="nombre" name="nombre" required placeholder="Ej: Juan Pérez" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contacto">Contacto (whatsapp, email)</Label>
                  <Input id="contacto" name="contacto" placeholder="+57 300 123 4567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fecha_inicio">Fecha de inicio</Label>
                  <Input id="fecha_inicio" name="fecha_inicio" type="date" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <select id="tipo" name="tipo" defaultValue="mentoria" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="mentoria">Mentoría (recurrente)</option>
                    <option value="asesoria">Asesoría (puntual)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nivel">Nivel (tu evaluación)</Label>
                  <Input id="nivel" name="nivel" placeholder="Principiante / Intermedio / Avanzado" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <select id="estado" name="estado" defaultValue="activo" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="activo">Activo</option>
                  <option value="pausado">Pausado</option>
                  <option value="graduado">Graduado</option>
                  <option value="abandonado">Abandonado</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notas">Notas privadas (solo tú las ves)</Label>
                <textarea
                  id="notas" name="notas" rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Lo que te falta evaluar, fortalezas, áreas a mejorar, contexto..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">Crear estudiante</Button>
                <Button asChild variant="outline">
                  <Link href="/admin/mentorias">Cancelar</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
