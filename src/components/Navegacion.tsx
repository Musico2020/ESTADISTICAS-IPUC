"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Map as MapIcon, Home, Users, HeartHandshake, PlusCircle, ClipboardList, HeartPulse, BarChart3,
  FileSpreadsheet, ShieldCheck, LogOut, Plus, Menu, X, User, type LucideIcon,
} from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { ETIQUETA_ROL } from "@/lib/roles";
import { seccionDe, type Seccion } from "@/lib/secciones";
import type { Perfil } from "@/lib/tipos";

type Enlace = { href: string; texto: string; icono: LucideIcon; seccion: Seccion };
type Grupo = { titulo: string; enlaces: Enlace[] };

function grupos(perfil: Perfil): Grupo[] {
  const coordina = perfil.rol === "coordinador_sector" || perfil.rol === "coordinador_zona";
  const analisis: Enlace[] = [{ href: "/estadisticas", texto: "Estadísticas", icono: BarChart3, seccion: "informes" }];
  if (perfil.rol === "administrador" || coordina) analisis.push({ href: "/informes", texto: "Informes", icono: FileSpreadsheet, seccion: "informes" });
  if (perfil.rol === "administrador") analisis.push({ href: "/administracion", texto: "Administración", icono: ShieldCheck, seccion: "admin" });
  return [
    { titulo: "Territorio", enlaces: [
      { href: "/mapa", texto: "Mapa", icono: MapIcon, seccion: "evangelismo" },
      { href: "/nuevo-reporte", texto: "Nuevo reporte", icono: PlusCircle, seccion: "evangelismo" },
      { href: "/reportes", texto: "Reportes", icono: ClipboardList, seccion: "evangelismo" },
    ] },
    { titulo: "Iglesia en casas", enlaces: [
      { href: "/cultos", texto: "Cultos", icono: Home, seccion: "cultos" },
      { href: "/vis", texto: "VIS hogares", icono: Users, seccion: "vis" },
      { href: "/amigos", texto: "Amigos", icono: HeartHandshake, seccion: "amigos" },
      { href: "/casos", texto: "Casos", icono: HeartPulse, seccion: "casos" },
    ] },
    { titulo: "Análisis", enlaces: analisis },
  ];
}

const REGISTRAR: Enlace[] = [
  { href: "/cultos/nuevo", texto: "Culto en casa", icono: Home, seccion: "cultos" },
  { href: "/vis/nuevo", texto: "Hogar VIS", icono: Users, seccion: "vis" },
  { href: "/amigos/nuevo", texto: "Amigo", icono: HeartHandshake, seccion: "amigos" },
  { href: "/nuevo-reporte", texto: "Jornada de evangelismo", icono: MapIcon, seccion: "evangelismo" },
];

const iniciales = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "U";

export default function Navegacion({ perfil }: { perfil: Perfil }) {
  const ruta = usePathname();
  const [hoja, setHoja] = useState<"" | "mas" | "registrar">("");
  const lista = grupos(perfil);
  const activo = (href: string) => ruta === href || (ruta.startsWith(href + "/") && !REGISTRAR.some((r) => r.href === ruta && r.href !== href));
  const actual = lista.flatMap((g) => g.enlaces.map((e) => ({ ...e, grupo: g.titulo }))).find((e) => activo(e.href));

  // Al navegar se cierra la hoja del celular.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reacción a la ruta, no un dato derivado
  useEffect(() => setHoja(""), [ruta]);

  async function salir() {
    await crearClienteNavegador().auth.signOut();
    window.location.assign("/ingreso");
  }

  const enlace = (e: Enlace, clase: string) => {
    const Icono = e.icono;
    return (
      <Link key={e.href} href={e.href} className={clase} data-seccion={e.seccion} aria-current={activo(e.href) ? "page" : undefined}>
        <span className="nav-icono"><Icono size={17} /></span><span>{e.texto}</span>
      </Link>
    );
  };

  return (
    <>
      <aside className="lateral" aria-label="Principal">
        <Link href="/mapa" className="lateral-marca">
          <Image src="/icono-ipuc.png" alt="Logo IPUC" width={42} height={42} unoptimized />
          <span><b>IPUC Dangond</b><small>Evangelismo y Misiones</small></span>
        </Link>
        <nav className="lateral-grupos">
          {lista.map((g) => (
            <div key={g.titulo}>
              <p className="lateral-titulo">{g.titulo}</p>
              {g.enlaces.map((e) => enlace(e, "lateral-enlace"))}
            </div>
          ))}
        </nav>
        <div className="lateral-perfil">
          <Link href="/cuenta" className="lateral-cuenta" title="Mi cuenta">
            <span className="avatar avatar-oro">{iniciales(perfil.nombre_completo)}</span>
            <span><b>{perfil.nombre_completo}</b><small>{ETIQUETA_ROL[perfil.rol]}</small></span>
          </Link>
          <button type="button" className="lateral-salir" onClick={() => void salir()} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={16} /></button>
        </div>
      </aside>

      <header className="superior">
        <Link href="/mapa" className="superior-logo"><Image src="/icono-ipuc.png" alt="Logo IPUC" width={34} height={34} unoptimized /></Link>
        <p className="superior-miga">{actual ? <>{actual.grupo} / <b>{actual.texto}</b></> : <b>IPUC Dangond</b>}</p>
        <Link href="/cuenta" className="superior-cuenta" title="Mi cuenta"><span className="avatar avatar-oro">{iniciales(perfil.nombre_completo)}</span><span className="superior-nombre">{perfil.nombre_completo.split(" ")[0]}</span></Link>
      </header>

      <nav className="inferior" aria-label="Accesos rápidos">
        {enlace(lista[0].enlaces[0], "inferior-enlace")}
        {enlace(lista[1].enlaces[0], "inferior-enlace")}
        <button type="button" className="inferior-registrar" onClick={() => setHoja(hoja === "registrar" ? "" : "registrar")} aria-expanded={hoja === "registrar"}>
          <span className="nav-icono"><Plus size={24} /></span><span>Registrar</span>
        </button>
        {enlace(lista[2].enlaces[0], "inferior-enlace")}
        <button type="button" className="inferior-enlace" onClick={() => setHoja(hoja === "mas" ? "" : "mas")} aria-expanded={hoja === "mas"}>
          <span className="nav-icono"><Menu size={17} /></span><span>Más</span>
        </button>
      </nav>

      {hoja && (
        <div className="hoja-fondo" onClick={() => setHoja("")}>
          <div className="hoja" role="dialog" aria-label={hoja === "mas" ? "Más opciones" : "Registrar"} onClick={(e) => e.stopPropagation()}>
            <div className="hoja-cabecera">
              <b>{hoja === "mas" ? "Todas las opciones" : "¿Qué va a registrar?"}</b>
              <button type="button" className="boton fantasma icono-solo" onClick={() => setHoja("")} aria-label="Cerrar"><X size={18} /></button>
            </div>
            {hoja === "registrar" ? (
              <div className="hoja-mosaico">{REGISTRAR.map((e) => {
                const Icono = e.icono;
                return <Link key={e.href} href={e.href} className="mosaico" data-seccion={e.seccion}><span className="nav-icono"><Icono size={20} /></span><span>{e.texto}</span></Link>;
              })}</div>
            ) : (
              <>
                {lista.map((g) => <div key={g.titulo}><p className="lateral-titulo">{g.titulo}</p><div className="hoja-lista">{g.enlaces.map((e) => enlace(e, "hoja-enlace"))}</div></div>)}
                <div className="hoja-lista">
                  <Link href="/cuenta" className="hoja-enlace" data-seccion="admin"><span className="nav-icono"><User size={17} /></span><span>Mi cuenta</span></Link>
                  <button type="button" className="hoja-enlace hoja-salir" onClick={() => void salir()}><span className="nav-icono"><LogOut size={17} /></span><span>Cerrar sesión</span></button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <MarcaSeccion seccion={seccionDe(ruta)} />
    </>
  );
}

// Pone el color de la sección en <body> para que botones, campos e íconos lo tomen.
function MarcaSeccion({ seccion }: { seccion: Seccion }) {
  useEffect(() => { document.body.dataset.seccion = seccion; }, [seccion]);
  return null;
}
