export type Rol = "coordinador" | "administrador";
export type TipoCaso = "enfermo" | "sordo" | "consejeria";
export type Dificultad = "poco_tiempo" | "falta_acompanamiento" | "rechazo" | "clima" | "ninguna" | "otra";
export type Poligono = { type: "Polygon"; coordinates: number[][][] };
export type Perfil = { id: string; nombre_completo: string; rol: Rol; zona_id: string | null; activo: boolean };
export type Zona = { id: string; numero: number; nombre: string; color_borde: string; geometria: Poligono };
export type Manzana = { id: string; zona_id: string; codigo: string; geometria: Poligono; activa: boolean };
export type EstadoManzana = { manzana_id: string; ultima_fecha: string; jornadas: number };
export const ETIQUETA_DIFICULTAD: Record<Dificultad, string> = {
  poco_tiempo: "Poco tiempo", falta_acompanamiento: "Falta de acompañamiento", rechazo: "Rechazo de las personas",
  clima: "Condiciones climáticas", ninguna: "Ninguna", otra: "Otra",
};
export const ETIQUETA_CASO: Record<TipoCaso, string> = {
  enfermo: "Persona enferma", sordo: "Persona sorda", consejeria: "Consejería o visitación",
};
