// Helpers de fechas para planeación semanal.

// Lunes como inicio de semana. Devuelve YYYY-MM-DD del lunes de la semana del ISO dado.
export function lunesDe(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const dow = d.getDay(); // 0=Dom .. 6=Sab
  const diff = (dow + 6) % 7; // días desde el lunes
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function sumarDias(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diasDeSemana(lunesIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunesIso, i));
}

export function hoyIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const DIAS_LARGO = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export function fechaCorta(iso: string): { dia: string; numero: number; mes: string } {
  const d = new Date(iso + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // lunes=0
  return { dia: DIAS_LARGO[dow], numero: d.getDate(), mes: MESES_CORTO[d.getMonth()] };
}

// Formatea hora HH:MM:SS o HH:MM a "9:30 AM" / "2:15 PM"
export function formatHora(hora: string | null): string {
  if (!hora) return "";
  const [h, m] = hora.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

// Minutos entre dos horas HH:MM:SS
export function minutosEntre(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return (bh * 60 + bm) - (ah * 60 + am);
}
