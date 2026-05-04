// Catálogo de personalización: temas, fuentes, modos, densidades.
// Sus valores deben coincidir con los CHECK constraints de migration_apariencia.sql.

export type Tema = "azul" | "verde" | "morado" | "rosa" | "naranja" | "cyan" | "negro" | "marron";
export type Fuente = "Inter" | "Poppins" | "Roboto" | "Montserrat" | "Open Sans" | "Lato" | "Nunito" | "Plus Jakarta Sans" | "Outfit" | "Playfair Display";
export type Modo = "claro" | "oscuro" | "auto";
export type Densidad = "compacta" | "normal" | "espaciada";

export interface Preferencias {
  tema: Tema;
  fuente: Fuente;
  modo: Modo;
  densidad: Densidad;
}

export const PREFS_DEFAULT: Preferencias = {
  tema: "azul", fuente: "Inter", modo: "auto", densidad: "normal",
};

export const TEMAS: { value: Tema; label: string; emoji: string; preview: string }[] = [
  { value: "azul",    label: "Azul Hexzor",    emoji: "💙", preview: "hsl(228 100% 56%)" },
  { value: "verde",   label: "Verde Esmeralda", emoji: "💚", preview: "hsl(142 71% 42%)" },
  { value: "morado",  label: "Morado Real",     emoji: "💜", preview: "hsl(270 80% 55%)" },
  { value: "rosa",    label: "Rosa Coral",      emoji: "🌸", preview: "hsl(340 82% 55%)" },
  { value: "naranja", label: "Naranja Sunset",  emoji: "🧡", preview: "hsl(24 95% 53%)" },
  { value: "cyan",    label: "Cyan Océano",     emoji: "🩵", preview: "hsl(190 90% 45%)" },
  { value: "negro",   label: "Negro Elegante",  emoji: "🖤", preview: "hsl(0 0% 12%)" },
  { value: "marron",  label: "Marrón Tierra",   emoji: "🤎", preview: "hsl(25 50% 35%)" },
];

export const FUENTES: { value: Fuente; label: string; sample: string }[] = [
  { value: "Inter",              label: "Inter",              sample: "Moderna y legible — la default" },
  { value: "Poppins",            label: "Poppins",            sample: "Geométrica y amigable" },
  { value: "Roboto",             label: "Roboto",             sample: "Clásica de Google, neutra" },
  { value: "Montserrat",         label: "Montserrat",         sample: "Elegante, ideal para títulos" },
  { value: "Open Sans",          label: "Open Sans",          sample: "Súper legible, profesional" },
  { value: "Lato",               label: "Lato",               sample: "Humanista y cálida" },
  { value: "Nunito",             label: "Nunito",             sample: "Redondeada, suave" },
  { value: "Plus Jakarta Sans",  label: "Plus Jakarta Sans",  sample: "Moderna, clean" },
  { value: "Outfit",             label: "Outfit",             sample: "Futurista y minimal" },
  { value: "Playfair Display",   label: "Playfair Display",   sample: "Serif elegante (estilo editorial)" },
];

export const MODOS: { value: Modo; label: string; emoji: string }[] = [
  { value: "claro",  label: "Claro",        emoji: "☀️" },
  { value: "oscuro", label: "Oscuro",       emoji: "🌙" },
  { value: "auto",   label: "Auto (sistema)", emoji: "🌗" },
];

export const DENSIDADES: { value: Densidad; label: string; desc: string }[] = [
  { value: "compacta",  label: "Compacta",  desc: "Más info en pantalla" },
  { value: "normal",    label: "Normal",    desc: "Balance recomendado" },
  { value: "espaciada", label: "Espaciada", desc: "Más respiro visual" },
];
