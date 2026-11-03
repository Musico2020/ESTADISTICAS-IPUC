import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Evangelismo IPUC Dangond",
  description: "Reportes, mapa y estadísticas de evangelismo de IPUC Barrio Dangond",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
