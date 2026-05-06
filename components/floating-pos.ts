"use client";

// Hook compartido para la posición de los widgets flotantes (Pomodoro + Coach Chat).
// Se guarda en localStorage. 4 esquinas posibles.

import { useEffect, useState } from "react";

export type Corner = "br" | "bl" | "tr" | "tl";

const STORAGE_KEY = "hexzor-flotante-pos";

// Clases de Tailwind por esquina, dos niveles (base = pegado al borde, raised = un poco hacia adentro y arriba/abajo).
export function cornerClasses(corner: Corner, raised = false): string {
  if (raised) {
    // Para Coach Chat: más arriba/abajo y más al centro
    switch (corner) {
      case "br": return "bottom-52 right-12";
      case "bl": return "bottom-52 left-12";
      case "tr": return "top-20 right-12";
      case "tl": return "top-20 left-12";
    }
  }
  // Pegado a la esquina (Pomodoro)
  switch (corner) {
    case "br": return "bottom-4 right-4";
    case "bl": return "bottom-4 left-4";
    case "tr": return "top-4 right-4";
    case "tl": return "top-4 left-4";
  }
}

export function nextCorner(c: Corner): Corner {
  return c === "br" ? "bl" : c === "bl" ? "tl" : c === "tl" ? "tr" : "br";
}

export function cornerLabel(c: Corner): string {
  return c === "br" ? "abajo derecha" : c === "bl" ? "abajo izquierda" : c === "tr" ? "arriba derecha" : "arriba izquierda";
}

export function useFloatingCorner(): { corner: Corner; setCorner: (c: Corner) => void; cycle: () => void } {
  const [corner, setCornerState] = useState<Corner>("br");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && ["br", "bl", "tr", "tl"].includes(v)) setCornerState(v as Corner);
    } catch { /* ignore */ }
    setHydrated(true);

    // Sincronizar entre instancias en la misma pestaña
    function onChange(e: Event) {
      const ev = e as CustomEvent<Corner>;
      if (ev.detail) setCornerState(ev.detail);
    }
    window.addEventListener("hexzor-corner-change", onChange);
    return () => window.removeEventListener("hexzor-corner-change", onChange);
  }, []);

  function setCorner(c: Corner) {
    setCornerState(c);
    if (hydrated) {
      try { localStorage.setItem(STORAGE_KEY, c); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent("hexzor-corner-change", { detail: c }));
    }
  }

  return { corner, setCorner, cycle: () => setCorner(nextCorner(corner)) };
}
