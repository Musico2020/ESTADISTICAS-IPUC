import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ETIQUETA_CASO, ETIQUETA_DIFICULTAD, type Dificultad, type TipoCaso } from "@/lib/tipos";
import type { DatosInforme } from "./datos";
import { filasPorZona, nombreArchivo } from "./resumen";

export function generarPdf({ estadisticas: e, desde, hasta, zonaNombre, casos }: DatosInforme) {
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(16);
  doc.text("Informe de evangelismo, IPUC Barrio Dangond", 14, y);
  doc.setFontSize(10);
  doc.text(`Período: ${desde} a ${hasta}. Zona: ${zonaNombre}.`, 14, (y += 7));
  y += 4;

  const tabla = (titulo: string, head: string[], body: (string | number)[][]) => {
    if (body.length === 0) return;
    doc.setFontSize(12);
    doc.text(titulo, 14, y + 4);
    autoTable(doc, { startY: y + 7, head: [head], body, styles: { fontSize: 9 }, headStyles: { fillColor: [30, 58, 138] } });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    if (y > 260) { doc.addPage(); y = 14; }
  };

  const t = e.totales;
  tabla("Totales", ["Indicador", "Valor"], [
    ["Jornadas", t.jornadas], ["Hogares visitados", t.hogares], ["Personas contactadas", t.personas],
    ["Aceptaron visita", t.visitas], ["Niños alcanzados", t.ninos], ["Receptividad promedio (1 a 5)", t.receptividad ?? "-"],
    ["Reportes sin manzanas marcadas", t.pendientes_marcar],
  ]);
  tabla("Avance por zona", ["Zona", "Jornadas", "Personas", "Manzanas alcanzadas", "Total manzanas", "Avance"], filasPorZona(e));
  tabla("Por mes", ["Mes", "Jornadas", "Personas", "Hogares"], e.por_mes.map((m) => [m.mes, m.jornadas, m.personas, m.hogares]));
  tabla("Dificultades", ["Dificultad", "Veces"], e.dificultades.map((d) => [ETIQUETA_DIFICULTAD[d.dificultad as Dificultad] ?? d.dificultad, d.cantidad]));
  if (casos) {
    tabla("Casos especiales", ["Fecha", "Zona", "Tipo", "Estado", "Descripción"], casos.map((c) => [
      c.reportes?.fecha_jornada ?? "", c.zonas?.nombre ?? "", ETIQUETA_CASO[c.tipo as TipoCaso] ?? c.tipo, c.estado, c.descripcion,
    ]));
  }
  doc.save(nombreArchivo("pdf", desde, hasta));
}
