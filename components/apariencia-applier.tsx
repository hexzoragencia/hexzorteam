"use client";
import { useEffect } from "react";
import type { Preferencias } from "@/lib/apariencia";

// Aplica la preferencia al <html> en cliente. Para usuarios anónimos
// (login/register) no se renderiza este componente y queda el default del CSS.
export function AparienciaApplier({ prefs }: { prefs: Preferencias }) {
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", prefs.tema);
    html.setAttribute("data-mode", prefs.modo);
    html.setAttribute("data-font", prefs.fuente);
    html.setAttribute("data-density", prefs.densidad);
  }, [prefs.tema, prefs.modo, prefs.fuente, prefs.densidad]);
  return null;
}
