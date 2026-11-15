export type TipoPersona = "nino_vis" | "amigo";
export type EstadoSeguimiento = "nuevo" | "en_seguimiento" | "congregado" | "sin_contacto";

export const ETIQUETA_TIPO: Record<TipoPersona, string> = { nino_vis: "VIS (niño visitado)", amigo: "Amigo" };
export const ETIQUETA_ESTADO: Record<EstadoSeguimiento, string> = {
  nuevo: "Nuevo", en_seguimiento: "En seguimiento", congregado: "Ya se congrega", sin_contacto: "Sin contacto",
};
export const RUTA_TIPO: Record<TipoPersona, string> = { nino_vis: "/vis", amigo: "/amigos" };

export type DatosPersona = {
  tipo: TipoPersona; zona_id: string; nombre: string; edad: string; telefono: string; direccion: string;
  lat: number | null; lon: number | null; acudiente: string; familia: string; calamidad: string;
  enfermo: boolean; pide_oracion: boolean; peticion: string; entrego_vida: boolean;
  estado_seguimiento: EstadoSeguimiento; notas: string; culto_id: string | null; autorizacion_acudiente: boolean;
};
export type ErroresPersona = Partial<Record<keyof DatosPersona, string>>;

export const personaVacia = (tipo: TipoPersona, zona_id = "", culto_id: string | null = null): DatosPersona => ({
  tipo, zona_id, nombre: "", edad: "", telefono: "", direccion: "", lat: null, lon: null, acudiente: "", familia: "",
  calamidad: "", enfermo: false, pide_oracion: false, peticion: "", entrego_vida: false, estado_seguimiento: "nuevo",
  notas: "", culto_id, autorizacion_acudiente: false,
});

// Un teléfono colombiano: 7 a 10 dígitos, con espacios, guiones o +57 opcionales.
export const telefonoValido = (t: string) => /^(\+?57)?\d{7,10}$/.test(t.replace(/[\s()-]/g, ""));

export function validarPersona(d: DatosPersona): ErroresPersona {
  const e: ErroresPersona = {};
  const nino = d.tipo === "nino_vis";
  if (!d.zona_id) e.zona_id = "Elija la zona";
  if (!d.nombre.trim()) e.nombre = nino ? "Escriba el nombre del niño" : "Escriba el nombre";
  const edad = d.edad.trim();
  if (nino && !edad) e.edad = "Escriba la edad del niño";
  else if (edad && !/^\d+$/.test(edad)) e.edad = "Escriba la edad en años, sin decimales";
  else if (edad && nino && +edad > 17) e.edad = "VIS es para menores de 18 años; registre a un adulto como amigo";
  else if (edad && +edad > 120) e.edad = "Revise la edad";
  if (d.telefono.trim() && !telefonoValido(d.telefono)) e.telefono = "Escriba un teléfono de 7 a 10 dígitos";
  if (nino && !d.acudiente.trim()) e.acudiente = "Escriba el nombre y parentesco del acudiente";
  if (nino && !d.autorizacion_acudiente) e.autorizacion_acudiente = "Sin la autorización del acudiente no se pueden guardar los datos del niño";
  if (d.pide_oracion && !d.peticion.trim()) e.peticion = "Escriba la petición de oración";
  return e;
}

const texto = (t: string) => t.trim() || null;

export function aFilaPersona(d: DatosPersona) {
  return {
    tipo: d.tipo, zona_id: d.zona_id, nombre: d.nombre.trim(), edad: d.edad.trim() ? +d.edad : null,
    telefono: texto(d.telefono), direccion: texto(d.direccion), lat: d.lat, lon: d.lon,
    acudiente: texto(d.acudiente), familia: texto(d.familia), calamidad: texto(d.calamidad),
    enfermo: d.enfermo, pide_oracion: d.pide_oracion, peticion: d.pide_oracion ? texto(d.peticion) : null,
    entrego_vida: d.entrego_vida, estado_seguimiento: d.estado_seguimiento, notas: texto(d.notas),
    culto_id: d.culto_id, autorizacion_acudiente: d.tipo === "nino_vis" ? d.autorizacion_acudiente : false,
  };
}
