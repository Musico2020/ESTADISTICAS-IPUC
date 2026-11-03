import ExcelJS from "exceljs";
import { ETIQUETA_CASO, ETIQUETA_DIFICULTAD, type Dificultad, type TipoCaso } from "@/lib/tipos";
import type { DatosInforme } from "./datos";
import { filasPorZona, nombreArchivo } from "./resumen";
import { textoSeguro } from "./seguro";

function hoja(libro: ExcelJS.Workbook, nombre: string, encabezados: string[], filas: (string | number | null)[][]) {
  const h = libro.addWorksheet(nombre);
  h.addRow(encabezados).font = { bold: true };
  filas.forEach((f) => h.addRow(f.map((v) => (typeof v === "string" ? textoSeguro(v) : v))));
  h.columns.forEach((c) => { c.width = 20; });
  h.views = [{ state: "frozen", ySplit: 1 }];
}

export async function generarExcel({ estadisticas: e, reportes, casos, desde, hasta }: DatosInforme) {
  const libro = new ExcelJS.Workbook();
  const t = e.totales;
  hoja(libro, "Resumen", ["Indicador", "Valor"], [
    ["Jornadas", t.jornadas], ["Hogares visitados", t.hogares], ["Personas contactadas", t.personas],
    ["Aceptaron visita", t.visitas], ["Niños alcanzados", t.ninos], ["Receptividad promedio", t.receptividad],
    ["Reportes sin manzanas marcadas", t.pendientes_marcar],
  ]);
  hoja(libro, "Por zona", ["Zona", "Jornadas", "Personas", "Manzanas alcanzadas", "Total manzanas", "Avance"], filasPorZona(e));
  hoja(libro, "Reportes",
    ["Fecha", "Zona", "Responsable", "Coordinador", "Manzanas", "Dirección", "Hogares", "Personas", "Aceptaron visita", "Nombres para visita",
      "Resultado espiritual", "Evangelismo a niños", "Niños", "Receptividad", "Dificultad", "Detalle dificultad", "Sugerencias", "Origen"],
    reportes.map((r) => [
      r.fecha_jornada as string, r.zonas?.nombre ?? "", r.responsable_nombre as string, r.coordinador_nombre as string,
      r.reporte_manzanas.map((m) => m.manzanas?.codigo).join(", "), r.direccion as string | null, r.hogares_visitados as number | null,
      r.personas_contactadas as number | null, r.personas_aceptan_visita as number | null, r.nombres_visita as string | null,
      r.resultado_espiritual as string | null, r.evangelismo_ninos ? "Sí" : "No", r.ninos_alcanzados as number | null, r.receptividad as number | null,
      r.dificultad ? ETIQUETA_DIFICULTAD[r.dificultad as Dificultad] : null, r.dificultad_otra as string | null, r.sugerencias as string | null,
      r.origen === "google_forms" ? "Google Forms" : "Aplicación",
    ]));
  if (casos) {
    hoja(libro, "Casos especiales", ["Fecha", "Zona", "Tipo", "Estado", "Descripción"], casos.map((c) => [
      c.reportes?.fecha_jornada ?? "", c.zonas?.nombre ?? "", ETIQUETA_CASO[c.tipo as TipoCaso] ?? c.tipo, c.estado, c.descripcion,
    ]));
  }
  const b = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([b], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo("xlsx", desde, hasta);
  a.click();
  URL.revokeObjectURL(url);
}
