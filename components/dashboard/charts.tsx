"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { formatMoney } from "@/lib/utils";

const COLORS = [
  "hsl(217 91% 60%)", // azul brillante
  "hsl(142 71% 45%)", // verde
  "hsl(38 92% 50%)",  // naranja
  "hsl(280 65% 60%)", // morado
  "hsl(0 72% 51%)",   // rojo
  "hsl(190 80% 50%)", // turquesa
  "hsl(48 96% 53%)",  // amarillo
  "hsl(330 81% 60%)", // rosa
  "hsl(120 50% 50%)", // verde claro
  "hsl(20 80% 55%)",  // coral
];

const mkFmt = (currency: string) => (n: number) => formatMoney(Math.round(n), currency);

// ===== Pie: Distribución del gasto por tipo =====
export function PieGastoPorTipo({ data, currency = "COP" }: { data: { name: string; value: number }[]; currency?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Sin gastos este mes.</p>;
  }
  const fmt = mkFmt(currency);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}
          label={(p: any) => (p.percent ?? 0) > 0.05 ? `${((p.percent ?? 0) * 100).toFixed(0)}%` : ""}
          labelLine={false}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Leyenda separada para el pie
export function PieLegend({ data, currency = "COP" }: { data: { name: string; value: number }[]; currency?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const fmt = mkFmt(currency);
  return (
    <ul className="space-y-1.5 text-sm">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="truncate">{d.name}</span>
          </span>
          <span className="tabular-nums text-muted-foreground shrink-0">
            {fmt(d.value)} <span className="text-xs">({((d.value / total) * 100).toFixed(0)}%)</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ===== Bar horizontal: Top categorías =====
export function BarTopCategorias({ data, currency = "COP" }: { data: { nombre: string; total: number }[]; currency?: string }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Sin gastos categorizados.</p>;
  }
  const fmt = mkFmt(currency);
  const height = Math.max(180, data.length * 36);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
        <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
        <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
        <Bar dataKey="total" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ===== Bar: Gastos día a día del mes =====
export function BarGastoDiario({ data, currency = "COP" }: { data: { etiqueta: string; gasto: number }[]; currency?: string }) {
  const total = data.reduce((s, d) => s + d.gasto, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Sin gastos en este período.</p>;
  }
  const fmt = mkFmt(currency);
  // Más espaciado en X si hay menos puntos
  const intervalo = data.length > 25 ? 2 : data.length > 14 ? 1 : 0;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={intervalo} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={70} />
        <Tooltip formatter={(v: any) => fmt(Number(v))} labelFormatter={(d: any) => `${d}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
        <Bar dataKey="gasto" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ===== Line: Ingresos vs Egresos del año =====
export function LineAnualIngresoEgreso({ data, currency = "COP" }: { data: { mes: string; ingresos: number; egresos: number }[]; currency?: string }) {
  const fmt = mkFmt(currency);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={75} />
        <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="ingresos" stroke="hsl(142 71% 45%)" strokeWidth={2.5} dot={{ r: 3 }} name="Ingresos" />
        <Line type="monotone" dataKey="egresos" stroke="hsl(0 72% 51%)" strokeWidth={2.5} dot={{ r: 3 }} name="Egresos" />
      </LineChart>
    </ResponsiveContainer>
  );
}
