import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const letra = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--letra", display: "swap" });

export const metadata: Metadata = {
  title: "Evangelismo IPUC Dangond",
  description: "Reportes, mapa y estadísticas de evangelismo de IPUC Barrio Dangond",
};

export const viewport: Viewport = { themeColor: "#0b1b3f" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={letra.variable}>
      <body data-seccion="evangelismo">{children}</body>
    </html>
  );
}
