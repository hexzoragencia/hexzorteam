import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser, getMisEspacios } from "@/lib/espacio";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { reiniciarTour } from "@/app/espacios/tour-actions";
import { redirect as nextRedirect } from "next/navigation";
import {
  Building2, User, LayoutDashboard, Receipt, Wallet, Tags, PiggyBank, CreditCard,
  Calculator, Settings, Sparkles, Calendar, Target, Clock, BookOpen, Bot, ArrowLeft,
  Lock, Lightbulb, MessageCircle, RefreshCw,
} from "lucide-react";

export default async function GuiaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const espacios = await getMisEspacios();
  const tienePersonal = espacios.some(e => e.tipo === "personal");
  const tieneEmpresarial = espacios.some(e => e.tipo === "empresarial");

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/icon.jpg" alt="Hexzor" width={36} height={36} priority />
            <div>
              <h1 className="font-bold tracking-tight flex items-center gap-2">
                Guía <BookOpen className="h-4 w-4 text-primary" />
              </h1>
              <p className="text-xs text-muted-foreground">Cómo usar Hexzor</p>
            </div>
          </div>
          <Link href="/espacios" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Volver
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Intro */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">¿Para qué sirve cada cosa?</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Hexzor es tu plataforma para tener orden total: finanzas personales + finanzas empresariales + productividad personal en un solo lugar. La idea es que escribas lo mínimo y la IA mantenga todo organizado por ti.
            </p>
          </div>
          <form action={async () => { "use server"; await reiniciarTour(); nextRedirect("/espacios"); }}>
            <Button type="submit" variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" /> Ver tour de bienvenida
            </Button>
          </form>
        </div>

        {/* Concepto de espacios */}
        <Section icon={<Building2 className="h-5 w-5" />} title="Tus 2 espacios">
          <p className="text-sm">
            Al registrarte se te crearon dos espacios separados, cada uno con su propio dinero, sus categorías y su dashboard:
          </p>
          <FeatureCard
            icon={<Building2 className="h-5 w-5 text-primary" />}
            title="Espacio Empresarial"
            desc="Para tu negocio. Aquí registras los ingresos por ventas, los gastos en pauta (FB/TT), los productos que vendes, las campañas, todo lo de la empresa."
            badge={tieneEmpresarial ? "Activo" : null}
          />
          <FeatureCard
            icon={<User className="h-5 w-5 text-primary" />}
            title="Espacio Personal"
            desc="Para tu vida. Tus gastos personales, tus ahorros, tus metas, tu productividad diaria. Puedes ponerle PIN para que nadie de tu equipo lo vea."
            badge={tienePersonal ? "Activo" : null}
            extra={
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Lock className="h-3 w-3" /> Para activar el PIN: ve al espacio personal y configúralo en su pantalla de configuración.
              </p>
            }
          />
        </Section>

        {/* Módulos financieros (en ambos espacios) */}
        <Section icon={<Wallet className="h-5 w-5" />} title="Finanzas (en los dos espacios)">
          <FeatureCard icon={<LayoutDashboard className="h-5 w-5 text-primary" />}
            title="Dashboard"
            desc="Tu vista de un vistazo: cuánto ingresaste, cuánto gastaste, capital total, alertas si algo se está desviando, y la sección 'Hoy y los últimos días' para que veas qué pasó hoy mismo."
          />
          <FeatureCard icon={<Receipt className="h-5 w-5 text-primary" />}
            title="Transacciones"
            desc="El libro diario. Cada vez que ingresas o gastas, registras un movimiento aquí: monto, fecha, categoría y una descripción opcional. Es la fuente de verdad de todo lo demás."
          />
          <FeatureCard icon={<Tags className="h-5 w-5 text-primary" />}
            title="Categorías"
            desc="Las etiquetas que organizan tu plata. Hay 6 tipos: Ingresos, Pagos programados (renta, internet), Suscripciones (Netflix, Spotify), Gasto mensual (comida, transporte), Ahorro y Deuda. Puedes editar las que vienen por defecto y crear las tuyas."
          />
          <FeatureCard icon={<Wallet className="h-5 w-5 text-primary" />}
            title="Presupuesto"
            desc="Lo que planeas gastar/ganar cada mes por categoría. Cuando registras transacciones, se compara automáticamente lo real vs lo planeado y te avisa si te estás pasando."
          />
          <FeatureCard icon={<PiggyBank className="h-5 w-5 text-primary" />}
            title="Ahorros"
            desc='Ahorros con meta y nombre — "Vacaciones", "Carro nuevo", "Fondo de emergencia". Defines cuánto quieres juntar, cuánto le metes mensual, y la app te dice cuándo lo tendrás listo.'
          />
          <FeatureCard icon={<CreditCard className="h-5 w-5 text-primary" />}
            title="Deudas (método Snowball)"
            desc="Lista todas tus deudas con su saldo y cuota. La app te calcula el plan Snowball: pagar primero la más pequeña para generar momento, luego la siguiente, hasta liquidar todo. Te muestra cuándo serás libre de deudas."
          />
        </Section>

        {/* Solo empresarial */}
        <Section icon={<Calculator className="h-5 w-5" />} title="Solo en Empresarial (Vasecom)">
          <FeatureCard icon={<Calculator className="h-5 w-5 text-primary" />}
            title="Calculadora multipaís"
            desc="Para validar productos antes de lanzarlos. Le pasas el costo del proveedor y para cada país (CO/MX/EC/ES/CL) calcula el precio de venta sugerido, el CPA objetivo, la utilidad y el precio de comparación, según los parámetros que tienes configurados."
          />
          <FeatureCard icon={<Settings className="h-5 w-5 text-primary" />}
            title="Configuración"
            desc="Ajustas los parámetros de la calculadora por país: flete base, % de entrega, % de CPA objetivo, % de utilidad y el factor de comparación. Cambias estos valores y la calculadora se recalcula sola."
          />
        </Section>

        {/* Solo personal */}
        <Section icon={<Sparkles className="h-5 w-5" />} title="Solo en Personal (productividad)">
          <FeatureCard icon={<Bot className="h-5 w-5 text-primary" />}
            title="Coach IA"
            desc="Cada día te genera un saludo, una frase motivacional, un análisis de tus fortalezas y debilidades, y una sugerencia concreta. Lee los datos reales de tus finanzas y tareas para hablarte con contexto, sin inventar nada."
          />
          <FeatureCard icon={<Sparkles className="h-5 w-5 text-primary" />}
            title="Hábitos de crecimiento"
            desc="Defines hábitos diarios que quieres construir (ej: leer 30min, meditar, ejercicio) y los marcas como hechos cada día. La app te muestra rachas y porcentaje de cumplimiento."
          />
          <FeatureCard icon={<Target className="h-5 w-5 text-primary" />}
            title="Objetivos"
            desc="Metas a mediano/largo plazo (ej: 'aprender inglés B2', 'leer 12 libros este año'). Defines fecha límite y vas marcando progreso."
          />
          <FeatureCard icon={<Calendar className="h-5 w-5 text-primary" />}
            title="Planeación diaria/semanal"
            desc="Tu agenda. Programas tareas con hora de inicio, duración y tipo. La app te muestra próxima tarea, atrasadas y te empuja a recuperar si te quedas atrás."
          />
          <FeatureCard icon={<Clock className="h-5 w-5 text-primary" />}
            title="Pomodoro"
            desc="Timer integrado a las tareas. Le das play y son 25 minutos de trabajo enfocado + 5 de descanso. Te ayuda a no procrastinar y a medir cuánto tiempo de verdad le metes a cada cosa."
          />
        </Section>

        {/* Cómo se usa el día a día */}
        <Section icon={<Lightbulb className="h-5 w-5" />} title="Flujo recomendado del día a día">
          <ol className="space-y-3 text-sm list-decimal pl-5">
            <li><b>Por la mañana:</b> entras al espacio personal, miras al Coach IA, revisas tu planeación del día y arrancas la primera tarea con Pomodoro.</li>
            <li><b>Cada vez que gastas o ingresas algo:</b> entras a Transacciones (en el espacio que corresponda) y lo registras en 10 segundos. La app actualiza el dashboard solo.</li>
            <li><b>Una vez por semana:</b> revisas dashboard, presupuesto y deudas. Ajustas si algo se desvió.</li>
            <li><b>Una vez al mes:</b> defines presupuesto del mes nuevo (puede ser un copy del anterior) y agregas/ajustas categorías si tu vida cambió.</li>
            <li><b>Cuando vas a lanzar producto nuevo (empresarial):</b> entras a la calculadora, le pasas el costo del proveedor y eliges el país. Te dice si el producto da números o no.</li>
          </ol>
        </Section>

        {/* Ayuda extra */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /> ¿Tienes dudas más específicas?</CardTitle>
            <CardDescription>El Coach IA dentro del espacio personal puede responder preguntas concretas sobre tus datos.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Pregúntale cosas como:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>"¿En qué estoy gastando más esta semana?"</li>
              <li>"¿Cuánto me falta para completar mi fondo de emergencia?"</li>
              <li>"¿Qué hábito estoy fallando más?"</li>
              <li>"Dame una sugerencia para hoy."</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{icon}</span> {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function FeatureCard({ icon, title, desc, badge, extra }: {
  icon: React.ReactNode; title: string; desc: string; badge?: string | null; extra?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold">{title}</h4>
              {badge && <span className="text-[10px] uppercase tracking-wide bg-success/15 text-success px-1.5 py-0.5 rounded font-medium">{badge}</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{desc}</p>
            {extra}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
