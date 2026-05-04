"use client";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from "recharts";
import { formatMoney } from "@/lib/utils";

const COLORS = ["hsl(217 91% 60%)","hsl(142 71% 45%)","hsl(38 92% 50%)","hsl(280 65% 60%)","hsl(0 72% 51%)","hsl(190 80% 50%)"];

export function PayoffChart({ data, deudas, currency = "COP" }: {
  data: { mes: number; fecha: string; total: number; [k: string]: any }[];
  deudas: { id: string; nombre: string }[];
  currency?: string;
}) {
  const fmt = (n: number) => formatMoney(Math.round(n), currency);
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Agrega deudas para ver la proyección.</p>;
  }
  const formatLabel = (v: any) => {
    const d = data.find(x => x.mes === v);
    return d ? `Mes ${d.mes} (${d.fecha.slice(0, 7)})` : `Mes ${v}`;
  };
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={75} />
        <Tooltip formatter={(v: any) => fmt(Number(v))} labelFormatter={formatLabel} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {deudas.map((d, i) => (
          <Area key={d.id} type="monotone" dataKey={d.id} stackId="1" stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.6} name={d.nombre} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
