import { telefonoValido, type EstadoSeguimiento } from "@/lib/persona/validar";

export const PARENTESCOS = ["Padre", "Madre", "Hijo", "Hija", "Abuelo", "Abuela", "Tío", "Tía", "Nieto", "Nieta", "Hermano", "Hermana", "Otro"];

export type Integrante = {
  id?: string; nombre: string; edad: string; parentesco: string; telefono: string;
  enfermo: boolean; pide_oracion: boolean; peticion: string; entrego_vida: boolean; estado_seguimiento: EstadoSeguimiento;
};
export type DatosHogar = {
  id?: string; zona_id: string; familia: string; direccion: string; lat: number | null; lon: number | null; precision_m: number | null;
  telefono: string; calamidad: string; pide_oracion: boolean; peticion: string; atendio: string;
  autorizacion_menores: boolean; estado_seguimiento: EstadoSeguimiento; notas: string; culto_id: string | null;
  integrantes: Integrante[];
};
export type ErroresIntegrante = Partial<Record<keyof Integrante, string>>;
export type ErroresHogar = Partial<Record<Exclude<keyof DatosHogar, "integrantes">, string>> & { integrantes?: string; porIntegrante?: ErroresIntegrante[] };

export const integranteVacio = (): Integrante => ({
  nombre: "", edad: "", parentesco: "", telefono: "", enfermo: false, pide_oracion: false, peticion: "", entrego_vida: false, estado_seguimiento: "nuevo",
});
export const hogarVacio = (zona_id = "", culto_id: string | null = null): DatosHogar => ({
  zona_id, familia: "", direccion: "", lat: null, lon: null, precision_m: null, telefono: "", calamidad: "", pide_oracion: false,
  peticion: "", atendio: "", autorizacion_menores: false, estado_seguimiento: "nuevo", notas: "", culto_id, integrantes: [integranteVacio()],
});

export const esMenor = (i: Integrante) => /^\d+$/.test(i.edad.trim()) && +i.edad < 18;
export const hayMenores = (d: DatosHogar) => d.integrantes.some(esMenor);

function validarIntegrante(i: Integrante): ErroresIntegrante {
  const e: ErroresIntegrante = {};
  if (!i.nombre.trim()) e.nombre = "Escriba el nombre";
  const edad = i.edad.trim();
  if (!edad) e.edad = "Escriba la edad";
  else if (!/^\d+$/.test(edad)) e.edad = "Edad en años, sin decimales";
  else if (+edad > 120) e.edad = "Revise la edad";
  if (!i.parentesco.trim()) e.parentesco = "Elija el parentesco";
  if (i.telefono.trim() && !telefonoValido(i.telefono)) e.telefono = "Teléfono de 7 a 10 dígitos";
  if (i.pide_oracion && !i.peticion.trim()) e.peticion = "Escriba la petición";
  return e;
}

export function validarHogar(d: DatosHogar): ErroresHogar {
  const e: ErroresHogar = {};
  if (!d.zona_id) e.zona_id = "Elija la zona";
  if (!d.familia.trim()) e.familia = "Escriba el nombre de la familia";
  if (!d.direccion.trim()) e.direccion = "Escriba la dirección del hogar";
  if (d.telefono.trim() && !telefonoValido(d.telefono)) e.telefono = "Escriba un teléfono de 7 a 10 dígitos";
  if (d.pide_oracion && !d.peticion.trim()) e.peticion = "Escriba la petición de oración";
  if (d.integrantes.length === 0) e.integrantes = "Agregue al menos un integrante de la familia";
  const por = d.integrantes.map(validarIntegrante);
  if (por.some((x) => Object.keys(x).length)) { e.porIntegrante = por; e.integrantes ??= "Revise los datos de los integrantes"; }
  if (hayMenores(d) && !d.autorizacion_menores) e.autorizacion_menores = "Hay menores de edad: falta la autorización del adulto responsable";
  return e;
}

const texto = (t: string) => t.trim() || null;

export function aParametrosHogar(d: DatosHogar) {
  return {
    p_hogar: {
      id: d.id ?? null, zona_id: d.zona_id, familia: d.familia.trim(), direccion: d.direccion.trim(), lat: d.lat, lon: d.lon,
      precision_m: d.precision_m, telefono: texto(d.telefono), calamidad: texto(d.calamidad), pide_oracion: d.pide_oracion,
      peticion: d.pide_oracion ? texto(d.peticion) : null, atendio: texto(d.atendio), autorizacion_menores: d.autorizacion_menores,
      estado_seguimiento: d.estado_seguimiento, notas: texto(d.notas), culto_id: d.culto_id,
    },
    p_integrantes: d.integrantes.map((i) => ({
      id: i.id ?? null, nombre: i.nombre.trim(), edad: +i.edad, parentesco: i.parentesco.trim(), telefono: texto(i.telefono),
      enfermo: i.enfermo, pide_oracion: i.pide_oracion, peticion: i.pide_oracion ? texto(i.peticion) : null,
      entrego_vida: i.entrego_vida, estado_seguimiento: i.estado_seguimiento,
    })),
  };
}
