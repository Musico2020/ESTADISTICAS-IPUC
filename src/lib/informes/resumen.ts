export type Estadisticas = {
  totales: { jornadas: number; hogares: number; personas: number; visitas: number; ninos: number; receptividad: number | null; pendientes_marcar: number };
  por_zona: { numero: number; nombre: string; manzanas_total: number; manzanas_alcanzadas: number; jornadas: number; personas: number }[];
  por_mes: { mes: string; jornadas: number; personas: number; hogares: number }[];
  dificultades: { dificultad: string; cantidad: number }[];
  casos: { tipo: string; cantidad: number; pendientes: number }[];
};

export const filasPorZona = (e: Estadisticas): (string | number)[][] =>
  e.por_zona.map((z) => [z.nombre, z.jornadas, z.personas, z.manzanas_alcanzadas, z.manzanas_total,
    `${z.manzanas_total ? Math.round((z.manzanas_alcanzadas / z.manzanas_total) * 100) : 0}%`]);

export const nombreArchivo = (ext: string, desde: string, hasta: string) => `informe-evangelismo-${desde}-a-${hasta}.${ext}`;
