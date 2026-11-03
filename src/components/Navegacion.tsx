"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Perfil } from "@/lib/tipos";

const COMUNES = [
  { href: "/mapa", texto: "Mapa" },
  { href: "/nuevo-reporte", texto: "Nuevo reporte" },
  { href: "/reportes", texto: "Reportes" },
  { href: "/casos", texto: "Casos" },
  { href: "/estadisticas", texto: "Estadísticas" },
];
const ADMIN = [
  { href: "/informes", texto: "Informes" },
  { href: "/administracion", texto: "Administración" },
];

export default function Navegacion({ perfil }: { perfil: Perfil }) {
  const ruta = usePathname();
  const enlaces = [...COMUNES, ...(perfil.rol === "administrador" ? ADMIN : []), { href: "/cuenta", texto: "Cuenta" }];

  async function salir() {
    await crearClienteNavegador().auth.signOut();
    window.location.assign("/ingreso");
  }

  return (
    <nav className="navegacion" aria-label="Principal">
      {enlaces.map((e) => (
        <Link key={e.href} href={e.href} aria-current={ruta.startsWith(e.href) ? "page" : undefined}>{e.texto}</Link>
      ))}
      <button type="button" onClick={salir}>Salir</button>
    </nav>
  );
}
