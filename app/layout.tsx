import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getPreferenciasUsuario } from "@/lib/preferencias-server";
import { RegistrarSW } from "@/components/registrar-sw";

export const metadata: Metadata = {
  title: "Hexzor Empresarial",
  description: "Panel de gestión integral · Hexzorteam",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Hexzor", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#2547ff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = await getPreferenciasUsuario();
  return (
    <html
      lang="es"
      data-theme={prefs.tema}
      data-mode={prefs.modo}
      data-font={prefs.fuente}
      data-density={prefs.densidad}
    >
      <body>
        <RegistrarSW />
        {children}
      </body>
    </html>
  );
}
