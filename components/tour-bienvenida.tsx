"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { marcarTourCompletado } from "@/app/espacios/tour-actions";
import {
  Sparkles, Building2, User, Receipt, LayoutDashboard, Calculator,
  Bot, ChevronLeft, ChevronRight, X, ArrowRight, BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  icon: React.ReactNode;
  titulo: string;
  intro: string;
  bullets?: { icon?: React.ReactNode; texto: string }[];
  cta?: string;
};

function getSteps(nombre: string): Step[] {
  const primerNombre = nombre.split(" ")[0] || "tú";
  return [
    {
      icon: <Sparkles className="h-7 w-7" />,
      titulo: `¡Bienvenido a Hexzor, ${primerNombre}!`,
      intro:
        "Esta es tu plataforma para tener orden total: finanzas personales, finanzas del negocio y productividad — todo en un solo lugar. Te doy un recorrido de 1 minuto para que entiendas para qué sirve cada cosa. Si lo prefieres, puedes saltarlo arriba a la derecha.",
    },
    {
      icon: <Building2 className="h-7 w-7" />,
      titulo: "Tienes 2 espacios separados",
      intro:
        "Cuando aprobamos tu cuenta se te crearon dos espacios independientes, cada uno con su propio dinero, sus categorías y su dashboard:",
      bullets: [
        { icon: <Building2 className="h-4 w-4" />, texto: "Empresarial → tu negocio: ventas, gastos en pauta, productos, calculadora multipaís." },
        { icon: <User className="h-4 w-4" />, texto: "Personal → tu vida: gastos personales, ahorros, hábitos, metas, productividad." },
      ],
    },
    {
      icon: <Receipt className="h-7 w-7" />,
      titulo: "Lo más importante: registrar lo que entra y sale",
      intro:
        "Esta es la base. Cada vez que ingresas plata o gastas, lo registras en Transacciones (toma 10 segundos):",
      bullets: [
        { texto: "1. Pones el monto y una descripción rápida" },
        { texto: "2. La app le asigna categoría automáticamente — tú no tienes que pensar en eso" },
        { texto: "3. Listo, ya queda registrado" },
      ],
      cta: "Mucho más fácil con el Coach IA: dile 'gasté 50k en mercado' y él lo registra.",
    },
    {
      icon: <BellRing className="h-7 w-7" />,
      titulo: "Pagos del mes — tus recordatorios",
      intro:
        "Esta es la sección más útil del día a día. Aquí pones tus pagos recurrentes (Netflix, internet, renta, etc.) con su fecha y monto, y la app te avisa cuando se acerca:",
      bullets: [
        { texto: "Cada pago tiene día (1-31), monto y recurrencia (mensual/semanal/anual)" },
        { texto: "Cuando se acerca la fecha, aparece una alerta visible en el Dashboard" },
        { texto: "Al pagarlo, se crea automáticamente la transacción para tu historial" },
      ],
      cta: 'También le puedes decir al Coach: "Netflix 36k todos los días 5" y queda agregado.',
    },
    {
      icon: <LayoutDashboard className="h-7 w-7" />,
      titulo: "Tu Dashboard",
      intro:
        "Tu vista de un vistazo:",
      bullets: [
        { texto: "Ingresos, gastos, ahorrado y balance del mes" },
        { texto: "Alerta si tienes pagos vencidos o próximos" },
        { texto: "Sección 'Hoy y los últimos días' con tus gastos del día y la semana" },
      ],
    },
    {
      icon: <Calculator className="h-7 w-7" />,
      titulo: "Solo en el espacio Empresarial",
      intro: "Tu negocio necesita algunas cosas extra que están en el espacio empresarial:",
      bullets: [
        { texto: "Calculadora multipaís → para validar productos antes de lanzar. Le das el costo del proveedor y te dice el precio de venta sugerido, CPA, utilidad y precio de comparación para CO/MX/EC/ES/CL." },
        { texto: "Configuración → ajustas los parámetros de la calculadora (flete, % entrega, % CPA objetivo) y se recalcula sola." },
        { texto: "Ahorros y Deudas (Snowball) → ahorros con meta + plan de liquidación de deudas." },
      ],
    },
    {
      icon: <Bot className="h-7 w-7" />,
      titulo: "Solo en el espacio Personal",
      intro: "Para tu vida personal hay módulos de productividad y un Coach IA:",
      bullets: [
        { texto: "Coach IA → cada día te genera un saludo, una frase y un análisis de qué estás haciendo bien o mal. Solo lee tus datos reales, no inventa." },
        { texto: "Hábitos / Objetivos → construyes hábitos diarios y fijas metas a mediano/largo plazo." },
        { texto: "Planeación + Pomodoro → tu agenda con tareas y un timer integrado de 25min trabajo + 5min descanso." },
      ],
    },
    {
      icon: <ArrowRight className="h-7 w-7" />,
      titulo: "¡Listo! Empieza por aquí:",
      intro: "Para arrancar bien, mi recomendación:",
      bullets: [
        { texto: "1. Entra a tu espacio Personal o Empresarial" },
        { texto: "2. Ve a \"Pagos del mes\" y agrega tus pagos recurrentes (Netflix, internet, renta...)" },
        { texto: "3. Registra una transacción en \"Transacciones\" o pídele al Coach IA que lo haga por ti" },
      ],
      cta: "Si en cualquier momento te quedan dudas, hay un botón \"Guía\" arriba que te explica cada cosa al detalle.",
    },
  ];
}

export function TourBienvenida({ nombreUsuario }: { nombreUsuario: string }) {
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const steps = getSteps(nombreUsuario);
  const total = steps.length;
  const current = steps[step];
  const esUltimo = step === total - 1;

  if (closed) return null;

  const cerrar = (marcado: boolean) => {
    if (marcado) {
      startTransition(async () => {
        await marcarTourCompletado();
        setClosed(true);
        router.refresh();
      });
    } else {
      setClosed(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4 animate-in fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) cerrar(false); }}
    >
      <div className="bg-card border-2 border-primary/30 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header con skip */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Tour de bienvenida · {step + 1}/{total}
          </div>
          <button
            type="button"
            onClick={() => cerrar(true)}
            disabled={pending}
            className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"
          >
            Saltar tour <X className="h-3 w-3" />
          </button>
        </div>

        {/* Contenido del paso */}
        <div className="px-6 pt-6 pb-4 space-y-4 min-h-[280px]">
          <div className="flex items-center gap-3">
            <div className="rounded-full p-3 bg-primary/15 text-primary">
              {current.icon}
            </div>
            <h2 className="text-xl font-bold tracking-tight flex-1">{current.titulo}</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.intro}</p>
          {current.bullets && (
            <ul className="space-y-2 pt-1">
              {current.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {b.icon && <span className="text-primary mt-0.5 shrink-0">{b.icon}</span>}
                  <span className="leading-relaxed">{b.texto}</span>
                </li>
              ))}
            </ul>
          )}
          {current.cta && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-3 pt-1">
              {current.cta}
            </p>
          )}
        </div>

        {/* Progress dots + nav */}
        <div className="px-5 pb-5 pt-2 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted"
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} disabled={pending}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
            )}
            {!esUltimo ? (
              <Button size="sm" onClick={() => setStep(step + 1)} disabled={pending}>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => cerrar(true)} disabled={pending}>
                {pending ? "Guardando..." : "¡Comenzar!"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
