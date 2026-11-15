import type { Perfil, Rol, Zona } from "@/lib/tipos";

// Reflejo en la interfaz de zonas_visibles() y puede_corregir() de la base de datos, que son las que mandan.
export const ETIQUETA_ROL: Record<Rol, string> = {
  administrador: "Superusuario",
  coordinador_sector: "Coordinador de sector",
  coordinador_zona: "Coordinador de zona",
  lider_zona: "Líder de zona",
  usuario: "Cuenta compartida (todas las zonas)",
};

type ZonaMin = Pick<Zona, "id" | "sector_id">;
type PerfilMin = Pick<Perfil, "id" | "rol" | "zona_id" | "sector_id">;

export function zonasPermitidas<T extends ZonaMin>(p: PerfilMin, zonas: T[]): T[] {
  if (p.rol === "administrador" || p.rol === "usuario") return zonas;
  if (p.rol === "coordinador_sector") return zonas.filter((z) => z.sector_id === p.sector_id);
  return zonas.filter((z) => z.id === p.zona_id);
}

export const eligeZona = (p: PerfilMin) => ["administrador", "usuario", "coordinador_sector"].includes(p.rol);

export function puedeCorregir(p: PerfilMin, zona: ZonaMin | undefined, autor: string): boolean {
  if (p.rol === "administrador") return true;
  if (!zona) return false;
  if (p.rol === "coordinador_sector") return zona.sector_id === p.sector_id;
  if (p.rol === "coordinador_zona") return zona.id === p.zona_id;
  return autor === p.id && zonasPermitidas(p, [zona]).length === 1;
}
