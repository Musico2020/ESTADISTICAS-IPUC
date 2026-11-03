"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Map as MapIcon,
  PlusCircle,
  ClipboardList,
  HeartPulse,
  BarChart3,
  FileSpreadsheet,
  ShieldCheck,
  User,
  LogOut,
} from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Perfil } from "@/lib/tipos";

type EnlaceNav = {
  href: string;
  texto: string;
  icono: typeof MapIcon;
};

const COMUNES: EnlaceNav[] = [
  { href: "/mapa", texto: "Mapa", icono: MapIcon },
  { href: "/nuevo-reporte", texto: "Nuevo reporte", icono: PlusCircle },
  { href: "/reportes", texto: "Reportes", icono: ClipboardList },
  { href: "/casos", texto: "Casos", icono: HeartPulse },
  { href: "/estadisticas", texto: "Estadísticas", icono: BarChart3 },
];

const ADMIN: EnlaceNav[] = [
  { href: "/informes", texto: "Informes", icono: FileSpreadsheet },
  { href: "/administracion", texto: "Administración", icono: ShieldCheck },
];

export default function Navegacion({ perfil }: { perfil: Perfil }) {
  const ruta = usePathname();
  const enlaces = [
    ...COMUNES,
    ...(perfil.rol === "administrador" ? ADMIN : []),
    { href: "/cuenta", texto: "Cuenta", icono: User },
  ];

  async function salir() {
    await crearClienteNavegador().auth.signOut();
    window.location.assign("/ingreso");
  }

  const iniciales = perfil.nombre_completo
    ? perfil.nombre_completo
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("")
    : "U";

  return (
    <header className="navegacion-contenedor">
      <nav className="navegacion" aria-label="Principal">
        {/* Marca en pantallas grandes */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 8 }}>
          <Image src="/icono-ipuc.png" alt="Logo de la Iglesia Pentecostal Unida de Colombia" width={38} height={38} unoptimized
            style={{ borderRadius: 10, background: "#ffffff", flexShrink: 0 }} />
          <div style={{ display: "none" }} className="marca-texto">
            <span style={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "-0.01em", display: "block", lineHeight: 1.1 }}>
              IPUC Dangond
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--tenue)" }}>Evangelismo</span>
          </div>
        </div>

        {/* Enlaces de Navegación */}
        {enlaces.map((e) => {
          const Icono = e.icono;
          const activo = ruta.startsWith(e.href);
          return (
            <Link
              key={e.href}
              href={e.href}
              className="navegacion-enlace"
              aria-current={activo ? "page" : undefined}
            >
              <Icono size={18} />
              <span>{e.texto}</span>
            </Link>
          );
        })}

        {/* Separador flexible */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Badge del usuario */}
          <Link
            href="/cuenta"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px 4px 6px",
              borderRadius: 999,
              background: "var(--superficie-tenue)",
              border: "1px solid var(--linea)",
              textDecoration: "none",
              color: "inherit",
            }}
            title={`${perfil.nombre_completo} (${perfil.rol})`}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--marca)",
                color: "#ffffff",
                fontSize: "0.75rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {iniciales}
            </span>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 600,
                maxWidth: 110,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {perfil.nombre_completo.split(" ")[0]}
            </span>
          </Link>
        </div>

        {/* Fijo a la derecha para que se vea aunque el menú se deslice en celular */}
        <button type="button" onClick={salir} className="navegacion-enlace navegacion-salir">
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
      </nav>
      <style jsx>{`
        @media (min-width: 960px) {
          .marca-texto {
            display: block !important;
          }
        }
      `}</style>
    </header>
  );
}
