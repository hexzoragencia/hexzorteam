"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X } from "lucide-react";
import { TourGuiado, tourYaVisto, resetearTour } from "./tour-guiado";

// El typing de react-joyride v3 está roto (Step no expone disableBeacon
// aunque sí es válido en runtime), por eso usamos any[] aquí.
type DefinicionTour = {
  id: string;
  nombre: string;
  steps: any[];
};

const TOURS: Record<string, DefinicionTour> = {
  "pagos": {
    id: "pagos-v1",
    nombre: "Guía de Pagos del mes",
    steps: [
      {
        target: "body",
        placement: "center",
        title: "👋 Bienvenido a Pagos del mes",
        content:
          "Esta sección es tu agenda de pagos recurrentes. Aquí registras todo lo que pagas cada mes (Netflix, Shopify, internet, renta…) y la app te recuerda cuando se acercan o cuando se vencen. Te muestro paso a paso cómo usarla.",
        disableBeacon: true,
      },
      {
        target: '[data-tour="pagos-nuevo"]',
        title: "1️⃣ Crear un pago nuevo",
        content:
          "Aquí creas un pago. Le pones nombre (ej. Shopify), monto, día del mes en el que lo pagas (ej. 7), y si es mensual / semanal / anual / único. Si lo creas hoy y el día ya pasó este mes, automáticamente se acomoda al mes siguiente.",
      },
      {
        target: '[data-tour="pagos-kpis"]',
        title: "2️⃣ Tu resumen del mes",
        content:
          "Estas 4 tarjetas te dicen, de un vistazo: cuánto suman tus pagos del mes, cuánto ya pagaste, cuánto te falta y cuántos están vencidos. Si hay vencidos se ponen en rojo.",
        placement: "bottom",
      },
      {
        target: '[data-tour="pagos-lista"]',
        title: "3️⃣ Tu lista organizada por urgencia",
        content:
          "Tus pagos se agrupan automáticamente: ⚠️ Vencidos arriba (pagar urgente), 🔔 Próximos (en 2 días o menos), 📅 Pendientes (más adelante), y ✅ Ya pagados al final. No tienes que filtrar nada.",
        placement: "top",
      },
      {
        target: '[data-tour="pagos-lista"]',
        title: "4️⃣ Marcar como pagado",
        content:
          "Cuando pagues uno, dale al botón azul de ✓ Pagar. La app crea automáticamente la transacción en tu contabilidad y mueve el pago a la sección ✅ Ya pagados. Si te equivocaste, dale Deshacer.",
        placement: "top",
      },
      {
        target: "body",
        placement: "center",
        title: "🔔 Y lo mejor: te aviso al celular",
        content:
          "Si tienes un pago vencido o que se acerca, recibes una notificación a las 8:00 AM en tu iPhone. Para activar las notis ve a Datos del espacio → Notificaciones. ¡Listo, ya sabes cómo usar Pagos del mes!",
      },
    ],
  },
};

function detectarTourPorRuta(pathname: string): DefinicionTour | null {
  if (pathname.includes("/pagos")) return TOURS.pagos;
  return null;
}

export function BotonAyuda() {
  const pathname = usePathname();
  const [run, setRun] = useState(false);
  const [tour, setTour] = useState<DefinicionTour | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    const t = detectarTourPorRuta(pathname);
    setTour(t);
    setRun(false);
    if (t && !tourYaVisto(t.id)) {
      const tmr = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(tmr);
    }
  }, [pathname]);

  if (!montado) return null;

  function abrir() {
    if (!tour) return;
    resetearTour(tour.id);
    setRun(false);
    setTimeout(() => setRun(true), 50);
  }

  return (
    <>
      {tour && (
        <TourGuiado
          steps={tour.steps}
          run={run}
          tourId={tour.id}
          onClose={() => setRun(false)}
        />
      )}
      <button
        onClick={abrir}
        disabled={!tour}
        title={tour ? `Ver guía: ${tour.nombre}` : "Aún no hay guía para esta sección"}
        className={
          "fixed bottom-5 left-5 z-40 flex items-center justify-center h-12 w-12 rounded-full shadow-lg border transition " +
          (tour
            ? "bg-primary text-primary-foreground hover:scale-110 cursor-pointer border-primary"
            : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed border-muted")
        }
        aria-label="Guía de uso"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
    </>
  );
}
