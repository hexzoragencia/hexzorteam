import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SYMBOLS: Record<string, string> = { COP: "$", MXN: "$", USD: "$", EUR: "€", CLP: "$" };
const LOCALES: Record<string, string> = { COP: "es-CO", MXN: "es-MX", USD: "en-US", EUR: "es-ES", CLP: "es-CL" };

export function formatMoney(value: number, currency = "COP") {
  const symbol = SYMBOLS[currency] ?? "$";
  const locale = LOCALES[currency] ?? "es-CO";
  const fixed = currency === "EUR" || currency === "USD" ? 2 : 0;
  // Nunca reventar por un valor null/undefined/NaN proveniente de la BD.
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `${symbol}${safe.toLocaleString(locale, { maximumFractionDigits: fixed, minimumFractionDigits: fixed })}`;
}

export function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function formatDateLong(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function relativeDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  const diff = Math.floor((today.getTime() - d.getTime()) / dayMs);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff > 1 && diff < 7) return `Hace ${diff} días`;
  return formatDateLong(iso);
}
