import type { Dificultad, TipoCaso } from "@/lib/tipos";

export type ReporteImportado = {
  zona_id: string; responsable_nombre: string; coordinador_nombre: string; fecha_jornada: string; direccion: string | null;
  hogares_visitados: number | null; personas_contactadas: number | null; personas_aceptan_visita: number | null;
  nombres_visita: string | null; resultado_espiritual: string | null; evangelismo_ninos: boolean; ninos_alcanzados: number | null;
  receptividad: number | null; dificultad: Dificultad | null; dificultad_otra: string | null; sugerencias: string | null;
  huella_importacion: string;
};
export type ResultadoFila =
  | { ok: true; reporte: ReporteImportado; casos: { tipo: TipoCaso; descripcion: string }[]; advertencias: string[] }
  | { ok: false; motivo: string };

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const DIFICULTADES: Record<string, Dificultad> = {
  "poco tiempo": "poco_tiempo", "falta de acompañamiento": "falta_acompanamiento", "rechazo de las personas": "rechazo",
  "condiciones climáticas": "clima", ninguna: "ninguna", otra: "otra",
};

function aFecha(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v)) return v.toISOString().slice(0, 10);
  const t = String(v ?? "").trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const lat = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (lat) return `${lat[3]}-${lat[2].padStart(2, "0")}-${lat[1].padStart(2, "0")}`;
  return null;
}

async function sha256(texto: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function traducirFila(fila: Record<string, unknown>, zonas: { id: string; numero: number }[]): Promise<ResultadoFila> {
  const datos = new Map(Object.entries(fila).map(([k, v]) => [normalizar(k), v]));
  const tx = (clave: string) => String(datos.get(clave) ?? "").trim();
  const advertencias: string[] = [];
  const num = (clave: string, etiqueta: string) => {
    const t = tx(clave);
    if (!t) return null;
    if (/^\d+$/.test(t)) return +t;
    advertencias.push(`${etiqueta}: "${t}" no es un número`);
    return null;
  };
  const si = (clave: string) => normalizar(tx(clave)).startsWith("s");

  const numZona = tx("zona / bloque asignado").match(/^zona\s*(\d)$/i)?.[1];
  const zona = zonas.find((z) => z.numero === Number(numZona));
  if (!zona) return { ok: false, motivo: `Zona inválida: "${tx("zona / bloque asignado")}"` };
  const fecha = aFecha(datos.get("fecha de la jornada evangelística"));
  if (!fecha) return { ok: false, motivo: `Fecha inválida: "${tx("fecha de la jornada evangelística")}"` };

  const visita = tx("personas que aceptaron visita posterior");
  const esNumeroVisita = /^\d+$/.test(visita);
  const difTexto = tx("dificultades encontradas durante la jornada");
  const dificultad = difTexto ? DIFICULTADES[normalizar(difTexto)] ?? "otra" : null;
  const receptividad = num("¿cómo evalúa la receptividad del sector?", "Receptividad");
  const nombre = tx("nombre completo");

  const descripcion = tx("si respondió sí a alguna anterior, describa brevemente el caso");
  const casos: { tipo: TipoCaso; descripcion: string }[] = [];
  if (si("¿se encontró alguna persona enferma que requiera visita hospitalaria?")) casos.push({ tipo: "enfermo", descripcion });
  if (si("¿se identificó alguna persona sorda?")) casos.push({ tipo: "sordo", descripcion });
  if (si("¿se detectó algún caso que requiera consejería o visitación especial?")) casos.push({ tipo: "consejeria", descripcion });

  return {
    ok: true, casos, advertencias,
    reporte: {
      zona_id: zona.id, responsable_nombre: nombre, coordinador_nombre: tx("nombre del coordinador de zona"), fecha_jornada: fecha,
      direccion: tx("manzana(s) trabajada(s)") || null,
      hogares_visitados: num("cantidad de hogares visitados", "Hogares visitados"),
      personas_contactadas: num("cantidad de personas contactadas", "Personas contactadas"),
      personas_aceptan_visita: esNumeroVisita ? +visita : null,
      nombres_visita: visita && !esNumeroVisita ? visita : null,
      resultado_espiritual: tx("breve descripción del resultado espiritual") || null,
      evangelismo_ninos: si("¿se realizó evangelismo a niños en la zona?"),
      ninos_alcanzados: num("cantidad aproximada de niños alcanzados", "Niños alcanzados"),
      receptividad: receptividad && receptividad >= 1 && receptividad <= 5 ? receptividad : null,
      dificultad, dificultad_otra: dificultad === "otra" && normalizar(difTexto) !== "otra" ? difTexto : null,
      sugerencias: tx("sugerencias para mejorar el trabajo en esta zona") || null,
      huella_importacion: await sha256([tx("marca temporal"), nombre, fecha].join("|")),
    },
  };
}
