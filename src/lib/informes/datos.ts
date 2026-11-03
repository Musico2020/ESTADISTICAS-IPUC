import type { SupabaseClient } from "@supabase/supabase-js";
import type { Estadisticas } from "./resumen";

export type FilaInforme = Record<string, string | number | boolean | null> & {
  zonas: { nombre: string } | null;
  reporte_manzanas: { manzanas: { codigo: string } | null }[];
};
export type CasoInforme = { tipo: string; descripcion: string; estado: string; zonas: { nombre: string } | null; reportes: { fecha_jornada: string } | null };
export type DatosInforme = {
  estadisticas: Estadisticas; reportes: FilaInforme[]; casos?: CasoInforme[];
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
  o: { desde: string; hasta: string; zona: string; zonaNombre: string; incluirCasos: boolean },
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
  return { estadisticas: data as Estadisticas, reportes, casos, desde: o.desde, hasta: o.hasta, zonaNombre: o.zonaNombre };
}
