import { requireEspacio } from "@/lib/espacio";
import { Card, CardContent } from "@/components/ui/card";
import { PiggyBank } from "lucide-react";

export default async function FondosPage({ params }: { params: { slug: string } }) {
  await requireEspacio(params.slug);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fondos de reserva</h1>
        <p className="text-muted-foreground">Ahorros con metas, progreso y proyección de cuándo se cumplen.</p>
      </div>
      <Card>
        <CardContent className="pt-6 text-center space-y-3 py-12">
          <PiggyBank className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">Próximamente — Fase 3</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Aquí verás cada fondo con su meta, lo ahorrado, lo que falta, el ritmo mensual y la fecha estimada de cumplimiento. Igual que la pestaña "Fondos de reserva" del Excel.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
