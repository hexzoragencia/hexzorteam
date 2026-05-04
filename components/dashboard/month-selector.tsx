"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export function MonthSelector({ ano, mes }: { ano: number; mes: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function go(nextAno: number, nextMes: number) {
    const params = new URLSearchParams(sp.toString());
    params.set("ano", String(nextAno));
    params.set("mes", String(nextMes));
    router.push(`${pathname}?${params.toString()}`);
  }

  function prev() {
    if (mes === 1) go(ano - 1, 12); else go(ano, mes - 1);
  }
  function next() {
    if (mes === 12) go(ano + 1, 1); else go(ano, mes + 1);
  }

  const anos = [ano - 1, ano, ano + 1];

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={prev} aria-label="Mes anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
        value={mes}
        onChange={(e) => go(ano, Number(e.target.value))}
      >
        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>

      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
        value={ano}
        onChange={(e) => go(Number(e.target.value), mes)}
      >
        {anos.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>

      <Button variant="outline" size="icon" onClick={next} aria-label="Mes siguiente">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
