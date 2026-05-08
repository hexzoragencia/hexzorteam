"use client";

import { useEffect } from "react";

export function RegistrarSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[SW] registro falló", err));
  }, []);

  return null;
}
