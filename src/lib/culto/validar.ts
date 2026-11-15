export type DatosCulto = {
  zona_id: string; fecha: string; direccion: string; lat: number | null; lon: number | null; precision_m: number | null;
  hermanos: string; amigos: string; ninos: string; ofrenda: string;
  hubo_enfermos: boolean; se_oro_enfermos: boolean; observaciones: string;
};
export type ErroresCulto = Partial<Record<keyof DatosCulto | "ubicacion", string>>;

export const cultoVacio = (zona_id = ""): DatosCulto => ({
  zona_id, fecha: new Date().toISOString().slice(0, 10), direccion: "", lat: null, lon: null, precision_m: null,
  hermanos: "", amigos: "", ninos: "", ofrenda: "", hubo_enfermos: false, se_oro_enfermos: false, observaciones: "",
});

// La ofrenda es en pesos, sin centavos: se aceptan "50000", "50.000" o "$ 50.000".
export function pesos(texto: string): number | null {
  const limpio = texto.trim().replace(/^\$\s*/, "");
  if (!limpio) return 0;
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(limpio)) return null;
  return Number(limpio.replace(/\./g, ""));
}

const entero = (v: string) => /^\d+$/.test(v.trim());

export function validarCulto(d: DatosCulto): ErroresCulto {
  const e: ErroresCulto = {};
  if (!d.zona_id) e.zona_id = "Elija la zona";
  if (!d.fecha) e.fecha = "Elija la fecha del culto";
  else if (d.fecha > new Date().toISOString().slice(0, 10)) e.fecha = "La fecha no puede ser futura";
  if (!d.direccion.trim()) e.direccion = "Escriba la dirección de la casa";
  if (d.lat === null || d.lon === null) e.ubicacion = "Toque «Usar mi ubicación» o marque la casa en el mapa";
  for (const c of ["hermanos", "amigos", "ninos"] as const) if (!entero(d[c])) e[c] = "Escriba un número entero";
  if (pesos(d.ofrenda) === null) e.ofrenda = "Escriba solo el valor en pesos, por ejemplo 50000";
  return e;
}

export function aFilaCulto(d: DatosCulto) {
  return {
    zona_id: d.zona_id, fecha: d.fecha, direccion: d.direccion.trim(), lat: d.lat, lon: d.lon, precision_m: d.precision_m,
    hermanos: +d.hermanos, amigos: +d.amigos, ninos: +d.ninos, ofrenda: pesos(d.ofrenda) ?? 0,
    hubo_enfermos: d.hubo_enfermos, se_oro_enfermos: d.hubo_enfermos && d.se_oro_enfermos,
    observaciones: d.observaciones.trim() || null,
  };
}

export const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const formatoPesos = (n: number) => `$ ${n.toLocaleString("es-CO")}`;
