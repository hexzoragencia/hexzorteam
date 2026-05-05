"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, CalendarRange, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type Modo = "mes" | "dia" | "rango";

export function MonthSelector({ ano, mes }: { ano: number; mes: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // El modo y las fechas vienen de la URL
  const modoUrl = (sp.get("modo") ?? "mes") as Modo;
  const fromUrl = sp.get("from");
  const toUrl = sp.get("to");

  const [modo, setModo] = useState<Modo>(modoUrl);
  const [from, setFrom] = useState<string>(fromUrl ?? hoyIso());
  const [to, setTo] = useState<string>(toUrl ?? hoyIso());

  useEffect(() => {
    setModo(modoUrl);
    if (fromUrl) setFrom(fromUrl);
    if (toUrl) setTo(toUrl);
  }, [modoUrl, fromUrl, toUrl]);

  function ir(params: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v === null) next.delete(k);
      else next.set(k, v);
    });
    router.push(`${pathname}?${next.toString()}`);
  }

  function cambiarModo(m: Modo) {
    setModo(m);
    if (m === "mes") {
      ir({ modo: null, from: null, to: null }); // limpia, vuelve a mes/ano
    } else if (m === "dia") {
      const f = from || hoyIso();
      ir({ modo: "dia", from: f, to: f });
    } else {
      // rango: por defecto últimos 7 días
      const t = to || hoyIso();
      const f = from || sumarDiasIso(t, -6);
      ir({ modo: "rango", from: f, to: t });
    }
  }

  function aplicarDia(fecha: string) {
    setFrom(fecha); setTo(fecha);
    ir({ modo: "dia", from: fecha, to: fecha });
  }
  function aplicarRango(f: string, t: string) {
    if (f > t) [f, t] = [t, f];
    setFrom(f); setTo(t);
    ir({ modo: "rango", from: f, to: t });
  }

  // Navegación con flechas en cada modo
  function prev() {
    if (modo === "mes") {
      if (mes === 1) ir({ ano: String(ano - 1), mes: "12" });
      else ir({ mes: String(mes - 1) });
    } else if (modo === "dia") {
      const f = sumarDiasIso(from, -1);
      aplicarDia(f);
    } else {
      const dias = diasEntre(from, to) + 1;
      const nf = sumarDiasIso(from, -dias);
      const nt = sumarDiasIso(to, -dias);
      aplicarRango(nf, nt);
    }
  }
  function next() {
    if (modo === "mes") {
      if (mes === 12) ir({ ano: String(ano + 1), mes: "1" });
      else ir({ mes: String(mes + 1) });
    } else if (modo === "dia") {
      const f = sumarDiasIso(from, 1);
      aplicarDia(f);
    } else {
      const dias = diasEntre(from, to) + 1;
      const nf = sumarDiasIso(from, dias);
      const nt = sumarDiasIso(to, dias);
      aplicarRango(nf, nt);
    }
  }
  function hoy() {
    const h = hoyIso();
    if (modo === "dia") aplicarDia(h);
    else if (modo === "rango") aplicarRango(sumarDiasIso(h, -6), h);
    else {
      const d = new Date(h + "T00:00:00");
      ir({ ano: String(d.getFullYear()), mes: String(d.getMonth() + 1) });
    }
  }

  const anos = [ano - 1, ano, ano + 1];

  return (
    <div className="flex flex-col gap-2">
      {/* Switch de modo */}
      <div className="inline-flex items-center gap-1 rounded-md border bg-card p-0.5 self-start">
        <ModoBtn activo={modo === "mes"} onClick={() => cambiarModo("mes")} icon={<Calendar className="h-3.5 w-3.5" />}>Mes</ModoBtn>
        <ModoBtn activo={modo === "dia"} onClick={() => cambiarModo("dia")} icon={<CalendarDays className="h-3.5 w-3.5" />}>Día</ModoBtn>
        <ModoBtn activo={modo === "rango"} onClick={() => cambiarModo("rango")} icon={<CalendarRange className="h-3.5 w-3.5" />}>Rango</ModoBtn>
      </div>

      {/* Controles según modo */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="icon" onClick={prev} className="h-9 w-9" aria-label="Anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {modo === "mes" && (
          <>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
              value={mes}
              onChange={(e) => ir({ mes: e.target.value })}
            >
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
              value={ano}
              onChange={(e) => ir({ ano: e.target.value })}
            >
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </>
        )}

        {modo === "dia" && (
          <input
            type="date"
            value={from}
            onChange={(e) => aplicarDia(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
          />
        )}

        {modo === "rango" && (
          <>
            <input
              type="date"
              value={from}
              onChange={(e) => aplicarRango(e.target.value, to)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
              title="Desde"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => aplicarRango(from, e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
              title="Hasta"
            />
          </>
        )}

        <Button variant="outline" size="sm" onClick={hoy} className="h-9">Hoy</Button>

        <Button variant="outline" size="icon" onClick={next} className="h-9 w-9" aria-label="Siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ModoBtn({ activo, onClick, icon, children }: { activo: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition",
        activo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      )}
    >
      {icon} {children}
    </button>
  );
}

function hoyIso(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(new Date());
}
function sumarDiasIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function diasEntre(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}
