import type { ReactNode } from "react";
import type { Seccion } from "@/lib/secciones";

// Colores de avatar: se elige por el nombre para que la misma persona siempre tenga el mismo.
const TONOS = ["#2563eb", "#059669", "#ea580c", "#db2777", "#0891b2", "#7c3aed", "#ca8a04", "#4f46e5"];
export const iniciales = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
const tono = (n: string) => TONOS[[...n].reduce((s, c) => s + c.charCodeAt(0), 0) % TONOS.length];

export function Avatar({ nombre }: { nombre: string }) {
  return <span className="avatar" style={{ background: tono(nombre) }} aria-hidden="true">{iniciales(nombre)}</span>;
}

export function Indicador({ seccion, icono, valor, texto, detalle }: { seccion: Seccion; icono: ReactNode; valor: ReactNode; texto: string; detalle?: ReactNode }) {
  return (
    <div className="kpi" data-seccion={seccion}>
      <div className="kpi-encabezado"><span className="kpi-icono">{icono}</span></div>
      <b>{valor}</b>
      <span>{texto}</span>
      {detalle && <small className="kpi-detalle">{detalle}</small>}
    </div>
  );
}

type Situacion = { enfermo: boolean; pide_oracion: boolean; entrego_vida: boolean };
export function Etiquetas({ fila }: { fila: Situacion }) {
  const lista = [
    fila.enfermo && <span key="e" className="badge" data-seccion="casos" style={{ background: "var(--marca-fondo)", color: "var(--marca)" }}>Enfermo</span>,
    fila.pide_oracion && <span key="o" className="badge" data-seccion="informes" style={{ background: "var(--marca-fondo)", color: "var(--marca)" }}>Pide oración</span>,
    fila.entrego_vida && <span key="v" className="badge badge-exito">Se entregó</span>,
  ].filter(Boolean);
  return lista.length ? <span className="fila" style={{ gap: 6 }}>{lista}</span> : <span className="tenue">-</span>;
}

export function Vacio({ icono, titulo, texto, accion }: { icono: ReactNode; titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="tarjeta vacio">
      <span className="vacio-icono">{icono}</span>
      <b>{titulo}</b>
      {texto && <p className="tenue">{texto}</p>}
      {accion}
    </div>
  );
}
