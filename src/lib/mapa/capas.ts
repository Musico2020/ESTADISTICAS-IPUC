import type { Zona } from "@/lib/tipos";

export type Capas = { manzanas: boolean; cultos: boolean; vis: boolean; amigos: boolean; bordes: boolean };
export const CAPAS_INICIALES: Capas = { manzanas: true, cultos: true, vis: true, amigos: true, bordes: true };
export type Situacion = "" | "enfermo" | "pide_oracion" | "entrego_vida";
export type PeriodoMapa = "mes" | "anio" | "todo" | "rango";

export const COLOR_CAPA = { cultos: "#22c55e", vis: "#2563eb", amigos: "#9333ea" } as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function rangoDe(tipo: PeriodoMapa, hoy: Date, desde = "", hasta = ""): { desde: string; hasta: string } {
  const a = hoy.getFullYear(), m = hoy.getMonth();
  if (tipo === "mes") return { desde: iso(new Date(Date.UTC(a, m, 1))), hasta: iso(new Date(Date.UTC(a, m + 1, 0))) };
  if (tipo === "anio") return { desde: `${a}-01-01`, hasta: `${a}-12-31` };
  if (tipo === "rango" && desde && hasta && desde <= hasta) return { desde, hasta };
  return { desde: "2000-01-01", hasta: "2100-12-31" };
}

// Zonas que quedan a la vista según los filtros de sector y zona.
export function zonasFiltradas(zonas: Zona[], sector: string, zona: string): Zona[] {
  if (zona) return zonas.filter((z) => z.id === zona);
  if (sector) return zonas.filter((z) => z.sector_id === sector);
  return zonas;
}

type ConZona = { zona_id: string };
export const enZonas = <T extends ConZona>(filas: T[], zonas: Zona[]) => {
  const ids = new Set(zonas.map((z) => z.id));
  return filas.filter((f) => ids.has(f.zona_id));
};

type Persona = ConZona & { tipo: "nino_vis" | "amigo"; enfermo: boolean; pide_oracion: boolean; entrego_vida: boolean };
type Culto = ConZona & { hubo_enfermos: boolean };

export function filtrarPorSituacion<P extends Persona, C extends Culto>(personas: P[], cultos: C[], s: Situacion) {
  if (!s) return { personas, cultos };
  return {
    personas: personas.filter((p) => p[s]),
    // De los cultos solo se sabe si hubo enfermos; con los otros filtros no aplica ninguno.
    cultos: s === "enfermo" ? cultos.filter((c) => c.hubo_enfermos) : [],
  };
}
