import type { Dificultad, TipoCaso } from "@/lib/tipos";

export type DatosReporte = {
  zona_id: string; responsable_nombre: string; coordinador_nombre: string; fecha_jornada: string;
  direccion: string; hogares_visitados: string; personas_contactadas: string; personas_aceptan_visita: string;
  nombres_visita: string; resultado_espiritual: string; caso_enfermo: boolean; caso_sordo: boolean;
  caso_consejeria: boolean; descripcion_caso: string; evangelismo_ninos: boolean; ninos_alcanzados: string;
  receptividad: string; dificultad: Dificultad | ""; dificultad_otra: string; sugerencias: string;
  manzanas: string[]; origen: "app" | "google_forms";
};
export type Errores = Partial<Record<keyof DatosReporte, string>>;

export const reporteVacio = (): DatosReporte => ({
  zona_id: "", responsable_nombre: "", coordinador_nombre: "", fecha_jornada: "", direccion: "",
  hogares_visitados: "", personas_contactadas: "", personas_aceptan_visita: "", nombres_visita: "",
  resultado_espiritual: "", caso_enfermo: false, caso_sordo: false, caso_consejeria: false, descripcion_caso: "",
  evangelismo_ninos: false, ninos_alcanzados: "", receptividad: "", dificultad: "", dificultad_otra: "",
  sugerencias: "", manzanas: [], origen: "app",
});

const esEntero = (v: string) => /^\d+$/.test(v.trim());

export function validarReporte(d: DatosReporte): Errores {
  const e: Errores = {};
  const requerir = (c: keyof DatosReporte, m: string) => { if (!String(d[c]).trim()) e[c] = m; };
  const numero = (c: keyof DatosReporte) => { if (!esEntero(String(d[c]))) e[c] = "Escriba un número entero, sin decimales"; };

  requerir("zona_id", "Elija la zona");
  requerir("responsable_nombre", "Escriba el nombre del responsable");
  requerir("coordinador_nombre", "Escriba el nombre del coordinador");
  requerir("fecha_jornada", "Elija la fecha de la jornada");
  if (d.fecha_jornada && d.fecha_jornada > new Date().toISOString().slice(0, 10)) e.fecha_jornada = "La fecha no puede ser futura";
  numero("hogares_visitados");
  numero("personas_contactadas");
  numero("personas_aceptan_visita");
  requerir("resultado_espiritual", "Describa el resultado espiritual");
  if (!["1", "2", "3", "4", "5"].includes(d.receptividad)) e.receptividad = "Califique de 1 a 5";
  requerir("dificultad", "Elija una opción");
  if (d.dificultad === "otra") requerir("dificultad_otra", "Describa la dificultad");
  if (d.evangelismo_ninos) numero("ninos_alcanzados");
  if (d.caso_enfermo || d.caso_sordo || d.caso_consejeria) requerir("descripcion_caso", "Describa brevemente el caso");
  if (d.origen === "app" && d.manzanas.length === 0) e.manzanas = "Toque en el mapa al menos una manzana";
  return e;
}

export function construirCasos(d: DatosReporte): { tipo: TipoCaso; descripcion: string }[] {
  const tipos: [boolean, TipoCaso][] = [[d.caso_enfermo, "enfermo"], [d.caso_sordo, "sordo"], [d.caso_consejeria, "consejeria"]];
  return tipos.filter(([marcado]) => marcado).map(([, tipo]) => ({ tipo, descripcion: d.descripcion_caso.trim() }));
}
