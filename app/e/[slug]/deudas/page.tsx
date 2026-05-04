import { requireEspacio } from "@/lib/espacio";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

export default async function DeudasPage({ params }: { params: { slug: string } }) {
  await requireEspacio(params.slug);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Deudas — Snowball</h1>
        <p className="text-muted-foreground">Calculadora estilo "bola de nieve" para pagar deudas más rápido.</p>
      </div>
      <Card>
        <CardContent className="pt-6 text-center space-y-3 py-12">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">Próximamente — Fase 4</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Aquí registras cada deuda con su balance, tasa de interés y cuota mínima. La app te calcula mes a mes cuándo terminas cada una y cuánto pagas en intereses totales.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
