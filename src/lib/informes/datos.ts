import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResumenActividad } from "./actividad";
import type { Estadisticas } from "./resumen";

export type FilaInforme = Record<string, string | number | boolean | null> & {
  zonas: { nombre: string } | null;
  reporte_manzanas: { manzanas: { codigo: string } | null }[];
};
export type CasoInforme = { tipo: string; descripcion: string; estado: string; zonas: { nombre: string } | null; reportes: { fecha_jornada: string } | null };
type ConZona = { zonas: { nombre: string } | null };
export type CultoInforme = ConZona & {
  fecha: string; dia_semana: number; direccion: string; hermanos: number; amigos: number; ninos: number; ofrenda: number;
  hubo_enfermos: boolean; se_oro_enfermos: boolean; observaciones: string | null;
};
export type PersonaInforme = ConZona & {
  tipo: "amigo" | "integrante"; nombre: string; edad: number | null; telefono: string | null; parentesco: string | null; familia: string | null;
  hogares: { familia: string } | null;
  direccion: string | null; calamidad: string | null; enfermo: boolean; pide_oracion: boolean; peticion: string | null;
  entrego_vida: boolean; estado_seguimiento: string; notas: string | null; creado_en: string;
};
export type VisitaInforme = ConZona & { fecha: string; notas: string | null; personas: { nombre: string; tipo: string } | null; hogares: { familia: string } | null };
export type HogarInforme = ConZona & {
  familia: string; direccion: string; telefono: string | null; atendio: string | null; calamidad: string | null; pide_oracion: boolean;
  peticion: string | null; estado_seguimiento: string; notas: string | null; creado_en: string; personas: { edad: number | null }[];
};
export type DatosInforme = {
  estadisticas: Estadisticas; reportes: FilaInforme[]; casos?: CasoInforme[];
  actividad: ResumenActividad; cultos: CultoInforme[]; personas?: PersonaInforme[]; visitas?: VisitaInforme[]; hogares?: HogarInforme[];
  desde: string; hasta: string; zonaNombre: string;
};

const LOTE = 1000;

// PostgREST limita cada respuesta a 1000 filas, así que se pide por lotes.
async function leerTodo<T>(pedir: (a: number, b: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const filas: T[] = [];
  for (let a = 0; ; a += LOTE) {
    const { data, error } = await pedir(a, a + LOTE - 1);
    if (error) throw error;
    filas.push(...(data as T[]));
    if ((data as T[]).length < LOTE) return filas;
  }
}

export async function cargarDatosInforme(
  db: SupabaseClient,
  o: { desde: string; hasta: string; zona: string; zonaNombre: string; incluirCasos: boolean; incluirPersonas?: boolean },
): Promise<DatosInforme> {
  const { data, error } = await db.rpc("estadisticas", { p_desde: o.desde, p_hasta: o.hasta, p_zona: o.zona || null });
  if (error) throw error;
  const reportes = await leerTodo<FilaInforme>((a, b) => {
    let c = db.from("reportes").select("*,zonas(nombre),reporte_manzanas(manzanas(codigo))")
      .gte("fecha_jornada", o.desde).lte("fecha_jornada", o.hasta);
    if (o.zona) c = c.eq("zona_id", o.zona);
    return c.order("fecha_jornada").order("id").range(a, b);
  });
  let casos: CasoInforme[] | undefined;
  if (o.incluirCasos) {
    casos = await leerTodo<CasoInforme>((a, b) => {
      let c = db.from("casos_especiales").select("tipo,descripcion,estado,zonas(nombre),reportes!inner(fecha_jornada)")
        .gte("reportes.fecha_jornada", o.desde).lte("reportes.fecha_jornada", o.hasta);
      if (o.zona) c = c.eq("zona_id", o.zona);
      return c.order("id").range(a, b);
    });
  }
  const act = await db.rpc("resumen_actividad", { p_desde: o.desde, p_hasta: o.hasta, p_zona: o.zona || null });
  if (act.error) throw act.error;
  const cultos = await leerTodo<CultoInforme>((a, b) => {
    let c = db.from("cultos").select("fecha,dia_semana,direccion,hermanos,amigos,ninos,ofrenda,hubo_enfermos,se_oro_enfermos,observaciones,zonas(nombre)")
      .gte("fecha", o.desde).lte("fecha", o.hasta);
    if (o.zona) c = c.eq("zona_id", o.zona);
    return c.order("fecha").order("id").range(a, b);
  });
  // Nombres, teléfonos y necesidades solo salen si se pide de forma expresa.
  let personas: PersonaInforme[] | undefined;
  let visitas: VisitaInforme[] | undefined;
  let hogares: HogarInforme[] | undefined;
  if (o.incluirPersonas) {
    personas = await leerTodo<PersonaInforme>((a, b) => {
      let c = db.from("personas").select("tipo,nombre,edad,telefono,parentesco,familia,direccion,calamidad,enfermo,pide_oracion,peticion,entrego_vida,estado_seguimiento,notas,creado_en,zonas(nombre),hogares(familia)")
        .gte("creado_en", o.desde).lte("creado_en", `${o.hasta}T23:59:59`);
      if (o.zona) c = c.eq("zona_id", o.zona);
      return c.order("creado_en").order("id").range(a, b);
    });
    visitas = await leerTodo<VisitaInforme>((a, b) => {
      let c = db.from("visitas").select("fecha,notas,zonas(nombre),personas(nombre,tipo),hogares(familia)").gte("fecha", o.desde).lte("fecha", o.hasta);
      if (o.zona) c = c.eq("zona_id", o.zona);
      return c.order("fecha").order("id").range(a, b);
    });
    hogares = await leerTodo<HogarInforme>((a, b) => {
      let c = db.from("hogares").select("familia,direccion,telefono,atendio,calamidad,pide_oracion,peticion,estado_seguimiento,notas,creado_en,zonas(nombre),personas(edad)")
        .gte("creado_en", o.desde).lte("creado_en", `${o.hasta}T23:59:59`);
      if (o.zona) c = c.eq("zona_id", o.zona);
      return c.order("creado_en").order("id").range(a, b);
    });
  }
  return {
    estadisticas: data as Estadisticas, reportes, casos, actividad: act.data as ResumenActividad, cultos, personas, visitas, hogares,
    desde: o.desde, hasta: o.hasta, zonaNombre: o.zonaNombre,
  };
}
