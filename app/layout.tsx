import type { Metadata, Viewport } from "next";
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
