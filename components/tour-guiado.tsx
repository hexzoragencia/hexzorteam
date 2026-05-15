"use client";

import dynamic from "next/dynamic";
import type { Step, CallBackProps } from "react-joyride";

const Joyride = dynamic(() => import("react-joyride"), { ssr: false });

export type { Step };

export function TourGuiado({
  steps,
  run,
  onClose,
  tourId,
}: {
  steps: Step[];
  run: boolean;
  onClose: () => void;
  tourId: string;
}) {
  function handle(data: CallBackProps) {
    const { status, type } = data;
    const finalizado = status === "finished" || status === "skipped";
    if (finalizado) {
      try { localStorage.setItem(`tour:${tourId}`, "1"); } catch {}
      onClose();
    }
    if (type === "tour:end") onClose();
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableOverlayClose
      callback={handle}
      locale={{
        back: "Atrás",
        close: "Cerrar",
        last: "Listo",
        next: "Siguiente",
        skip: "Saltar guía",
        open: "Abrir",
      }}
      styles={{
        options: {
          primaryColor: "#2547ff",
          zIndex: 10000,
          textColor: "#0a0a0a",
          backgroundColor: "#ffffff",
          arrowColor: "#ffffff",
          overlayColor: "rgba(0,0,0,0.55)",
        },
        tooltip: { borderRadius: 12, padding: 16 },
        tooltipTitle: { fontSize: 16, fontWeight: 700 },
        tooltipContent: { fontSize: 14, lineHeight: 1.5 },
        buttonNext: { borderRadius: 8, padding: "8px 16px", fontWeight: 600 },
        buttonBack: { color: "#666", marginRight: 8 },
        buttonSkip: { color: "#999" },
      }}
    />
  );
}

export function tourYaVisto(tourId: string): boolean {
  try { return localStorage.getItem(`tour:${tourId}`) === "1"; } catch { return false; }
}

export function resetearTour(tourId: string) {
  try { localStorage.removeItem(`tour:${tourId}`); } catch {}
}
