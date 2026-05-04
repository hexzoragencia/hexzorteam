"use client";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";

const PRIMARY = "hsl(var(--primary))";

// Línea anual: % por mes
export function LineHabitosAnual({ data }: { data: { mes: string; pct: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={45} />
        <Tooltip formatter={(v: any) => `${Number(v).toFixed(0)}%`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
        <Line type="monotone" dataKey="pct" stroke={PRIMARY} strokeWidth={2.5} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Bar horizontal: % por hábito (mes actual)
export function BarHabitos({ data }: { data: { nombre: string; pct: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aún no hay hábitos.</p>;
  }
  const height = Math.max(180, data.length * 32);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
        <XAxis type="number" tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis type="category" dataKey="nombre" width={150} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
        <Tooltip formatter={(v: any) => `${Number(v).toFixed(0)}%`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
        <Bar dataKey="pct" fill={PRIMARY} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Heatmap tipo GitHub: año completo
export function HeatmapAnual({ ano, fechasCount }: { ano: number; fechasCount: Record<string, number> }) {
  // Construir grilla: filas = día de la semana (Lun-Dom), columnas = semanas del año
  const start = new Date(Date.UTC(ano, 0, 1));
  const end = new Date(Date.UTC(ano + 1, 0, 1));
  const diasTotales = Math.floor((end.getTime() - start.getTime()) / 86400000);

  // Encontrar qué día de la semana es el 1 de enero (0=Lunes, 6=Domingo en este sistema)
  const dowJanFirst = (start.getUTCDay() + 6) % 7; // convertir Sunday=0 a Monday=0

  // maxCount para escalar colores
  const maxCount = Math.max(1, ...Object.values(fechasCount));

  const days: { fecha: string; count: number }[] = [];
  for (let i = 0; i < diasTotales; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ fecha: iso, count: fechasCount[iso] ?? 0 });
  }

  // Padding inicial: cuadros vacíos antes del 1 de enero
  const padded: ({ fecha: string; count: number } | null)[] = [
    ...Array(dowJanFirst).fill(null),
    ...days,
  ];

  // Agrupar en columnas de 7
  const cols: ({ fecha: string; count: number } | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));

  function color(count: number) {
    if (count === 0) return "hsl(var(--muted))";
    const intensity = Math.min(1, count / maxCount);
    // Usa el primary con opacidad creciente
    return `hsl(var(--primary) / ${0.2 + intensity * 0.8})`;
  }

  const MES_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  // Etiquetas de mes (sobre la columna del primer día de cada mes)
  const monthLabels: { col: number; name: string }[] = [];
  let lastMonth = -1;
  cols.forEach((col, ci) => {
    for (const cell of col) {
      if (cell) {
        const m = Number(cell.fecha.slice(5, 7)) - 1;
        if (m !== lastMonth) {
          monthLabels.push({ col: ci, name: MES_NAMES[m] });
          lastMonth = m;
        }
        break;
      }
    }
  });

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        {/* Etiquetas de meses */}
        <div className="flex gap-[2px] mb-1 ml-7 text-[10px] text-muted-foreground">
          {cols.map((_, ci) => {
            const ml = monthLabels.find(l => l.col === ci);
            return <div key={ci} style={{ width: 12 }}>{ml?.name ?? ""}</div>;
          })}
        </div>
        <div className="flex gap-[2px]">
          {/* Etiquetas de día de la semana */}
          <div className="flex flex-col gap-[2px] mr-1 text-[10px] text-muted-foreground">
            {["L","M","M","J","V","S","D"].map((d, i) => (
              <div key={i} style={{ height: 12 }}>{i % 2 === 0 ? d : ""}</div>
            ))}
          </div>
          {cols.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[2px]">
              {col.map((cell, ri) => (
                <div
                  key={ri}
                  className="rounded-sm"
                  style={{ width: 12, height: 12, background: cell ? color(cell.count) : "transparent" }}
                  title={cell ? `${cell.fecha}: ${cell.count} hábito${cell.count !== 1 ? "s" : ""}` : ""}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
          <span>Menos</span>
          {[0, 0.25, 0.5, 0.75, 1].map((o, i) => (
            <div key={i} className="rounded-sm" style={{ width: 12, height: 12, background: o === 0 ? "hsl(var(--muted))" : `hsl(var(--primary) / ${0.2 + o * 0.8})` }} />
          ))}
          <span>Más</span>
        </div>
      </div>
    </div>
  );
}
