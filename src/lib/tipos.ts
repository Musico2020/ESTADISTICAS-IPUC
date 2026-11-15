export type Rol = "administrador" | "coordinador_sector" | "coordinador_zona" | "lider_zona" | "usuario";
export type TipoCaso = "enfermo" | "sordo" | "consejeria";
export type Dificultad = "poco_tiempo" | "falta_acompanamiento" | "rechazo" | "clima" | "ninguna" | "otra";
export type Poligono = { type: "Polygon"; coordinates: number[][][] };
// Una zona es la unión de sus manzanas y puede quedar en varias partes.
export type Area = Poligono | { type: "MultiPolygon"; coordinates: number[][][][] };
export type Perfil = { id: string; nombre_completo: string; rol: Rol; zona_id: string | null; sector_id: string | null; activo: boolean };
export type Sector = { id: string; numero: number; nombre: string; color_borde: string; geometria: Area };
export type Zona = { id: string; numero: number; nombre: string; color_borde: string; geometria: Area; sector_id: string | null };
export type Manzana = { id: string; zona_id: string; codigo: string; geometria: Poligono; activa: boolean };
export type EstadoManzana = { manzana_id: string; ultima_fecha: string; jornadas: number };
export const ETIQUETA_DIFICULTAD: Record<Dificultad, string> = {
  poco_tiempo: "Poco tiempo", falta_acompanamiento: "Falta de acompañamiento", rechazo: "Rechazo de las personas",
  clima: "Condiciones climáticas", ninguna: "Ninguna", otra: "Otra",
};
export const ETIQUETA_CASO: Record<TipoCaso, string> = {
  enfermo: "Persona enferma", sordo: "Persona sorda", consejeria: "Consejería o visitación",
};
