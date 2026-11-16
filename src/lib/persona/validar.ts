// Fichas de amigos. Los integrantes de los hogares de VIS están en lib/hogar.
export type TipoPersona = "amigo";
export type EstadoSeguimiento = "nuevo" | "en_seguimiento" | "congregado" | "sin_contacto";

export const ETIQUETA_ESTADO: Record<EstadoSeguimiento, string> = {
  nuevo: "Nuevo", en_seguimiento: "En seguimiento", congregado: "Ya se congrega", sin_contacto: "Sin contacto",
};

export type DatosPersona = {
  tipo: TipoPersona; zona_id: string; nombre: string; edad: string; telefono: string; direccion: string;
  lat: number | null; lon: number | null; familia: string; calamidad: string;
  enfermo: boolean; pide_oracion: boolean; peticion: string; entrego_vida: boolean;
  estado_seguimiento: EstadoSeguimiento; notas: string; culto_id: string | null;
};
export type ErroresPersona = Partial<Record<keyof DatosPersona, string>>;

export const personaVacia = (zona_id = "", culto_id: string | null = null): DatosPersona => ({
  tipo: "amigo", zona_id, nombre: "", edad: "", telefono: "", direccion: "", lat: null, lon: null, familia: "",
  calamidad: "", enfermo: false, pide_oracion: false, peticion: "", entrego_vida: false, estado_seguimiento: "nuevo",
  notas: "", culto_id,
});

// Un teléfono colombiano: 7 a 10 dígitos, con espacios, guiones o +57 opcionales.
export const telefonoValido = (t: string) => /^(\+?57)?\d{7,10}$/.test(t.replace(/[\s()-]/g, ""));

export function validarPersona(d: DatosPersona): ErroresPersona {
  const e: ErroresPersona = {};
  if (!d.zona_id) e.zona_id = "Elija la zona";
  if (!d.nombre.trim()) e.nombre = "Escriba el nombre";
  const edad = d.edad.trim();
  if (edad && !/^\d+$/.test(edad)) e.edad = "Escriba la edad en años, sin decimales";
  else if (edad && +edad > 120) e.edad = "Revise la edad";
  if (d.telefono.trim() && !telefonoValido(d.telefono)) e.telefono = "Escriba un teléfono de 7 a 10 dígitos";
  if (d.pide_oracion && !d.peticion.trim()) e.peticion = "Escriba la petición de oración";
  return e;
}

const texto = (t: string) => t.trim() || null;

export function aFilaPersona(d: DatosPersona) {
  return {
    tipo: d.tipo, zona_id: d.zona_id, nombre: d.nombre.trim(), edad: d.edad.trim() ? +d.edad : null,
    telefono: texto(d.telefono), direccion: texto(d.direccion), lat: d.lat, lon: d.lon,
    familia: texto(d.familia), calamidad: texto(d.calamidad),
    enfermo: d.enfermo, pide_oracion: d.pide_oracion, peticion: d.pide_oracion ? texto(d.peticion) : null,
    entrego_vida: d.entrego_vida, estado_seguimiento: d.estado_seguimiento, notas: texto(d.notas), culto_id: d.culto_id,
  };
}
