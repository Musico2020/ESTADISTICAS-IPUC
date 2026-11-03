import type { EstadoManzana, Manzana } from "@/lib/tipos";

export const COLOR_ALCANZADA = "#22c55e";
export const COLOR_SIN_PREDICAR = "#ef4444";
export const colorManzana = (alcanzada: boolean) => (alcanzada ? COLOR_ALCANZADA : COLOR_SIN_PREDICAR);

export function calcularAvance(manzanas: Manzana[], estados: EstadoManzana[], zonaId?: string) {
  const conReporte = new Set(estados.map((e) => e.manzana_id));
  const activas = manzanas.filter((m) => m.activa && (!zonaId || m.zona_id === zonaId));
  const alcanzadas = activas.filter((m) => conReporte.has(m.id)).length;
  return { total: activas.length, alcanzadas, porcentaje: activas.length ? Math.round((alcanzadas / activas.length) * 100) : 0 };
}
