import { formatoPesos } from "@/lib/culto/validar";

export type ResumenActividad = {
  cultos: { total: number; hermanos: number; amigos: number; ninos: number; ofrenda: number; con_enfermos: number; se_oro: number; miercoles: number; viernes: number };
  // vis cuenta hogares visitados; integrantes y ninos son las personas de esos hogares.
  personas: { vis: number; hogares_oracion?: number; integrantes?: number; ninos?: number; amigos: number; enfermos: number; piden_oracion: number; entregaron: number; congregados: number };
  visitas: number;
  por_zona: { numero: number; nombre: string; cultos: number; hermanos: number; amigos: number; ofrenda: number; vis: number; integrantes?: number; fichas_amigos: number; entregaron: number; oracion: number; visitas: number }[];
  por_mes: { mes: string; cultos: number; hogares?: number; personas: number; visitas: number }[];
};

export const ENCABEZADOS_CULTOS_ZONA = ["Zona", "Cultos", "Hermanos", "Amigos", "Ofrenda"];
export const filasCultosPorZona = (r: ResumenActividad) =>
  r.por_zona.filter((z) => z.cultos > 0).map((z) => [z.nombre, z.cultos, z.hermanos, z.amigos, formatoPesos(z.ofrenda)]);

export const ENCABEZADOS_PERSONAS_ZONA = ["Zona", "Hogares VIS", "Personas en hogares", "Amigos", "Se entregaron", "Piden oración", "Visitas"];
export const filasPersonasPorZona = (r: ResumenActividad) =>
  r.por_zona.filter((z) => z.vis + z.fichas_amigos + z.visitas > 0).map((z) => [z.nombre, z.vis, z.integrantes ?? 0, z.fichas_amigos, z.entregaron, z.oracion, z.visitas]);

export const filasTotalesCultos = (r: ResumenActividad): (string | number)[][] => [
  ["Cultos en casas", r.cultos.total], ["Los miércoles", r.cultos.miercoles], ["Los viernes", r.cultos.viernes],
  ["Hermanos asistentes", r.cultos.hermanos], ["Amigos asistentes", r.cultos.amigos], ["Niños", r.cultos.ninos],
  ["Ofrenda", formatoPesos(r.cultos.ofrenda)], ["Cultos con enfermos", r.cultos.con_enfermos], ["Se oró por los enfermos", r.cultos.se_oro],
];

export const filasTotalesPersonas = (r: ResumenActividad): (string | number)[][] => [
  ["Hogares VIS visitados", r.personas.vis], ["Personas en esos hogares", r.personas.integrantes ?? 0],
  ["Niños y jóvenes en los hogares", r.personas.ninos ?? 0], ["Amigos registrados", r.personas.amigos],
  ["Se entregaron a Cristo", r.personas.entregaron], ["Ya se congregan", r.personas.congregados],
  ["Enfermos", r.personas.enfermos], ["Piden oración", r.personas.piden_oracion], ["Visitas realizadas", r.visitas],
];
