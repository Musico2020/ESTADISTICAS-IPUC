import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ETIQUETA_CASO, ETIQUETA_DIFICULTAD, type Dificultad, type TipoCaso } from "@/lib/tipos";
import type { DatosInforme } from "./datos";
import { ENCABEZADOS_CULTOS_ZONA, ENCABEZADOS_PERSONAS_ZONA, filasCultosPorZona, filasPersonasPorZona, filasTotalesCultos, filasTotalesPersonas } from "./actividad";
import { filasPorZona, nombreArchivo } from "./resumen";

async function logoComoDatos(): Promise<string | null> {
  try {
    const r = await fetch("/logo-ipuc.png");
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => resolver(lector.result as string);
      lector.onerror = rechazar;
      lector.readAsDataURL(b);
    });
  } catch {
    return null;
  }
}

export async function generarPdf({ estadisticas: e, desde, hasta, zonaNombre, casos, actividad: a, personas }: DatosInforme) {
  const doc = new jsPDF();
  // El informe se genera aunque el logo no cargue.
  const logo = await logoComoDatos();
  if (logo) doc.addImage(logo, "PNG", 166, 8, 30, 21);
  let y = 18;
  doc.setFontSize(16);
  doc.text("Informe general, IPUC Barrio Dangond", 14, y);
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
  tabla("Evangelismo: totales", ["Indicador", "Valor"], [
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
  tabla("Cultos en casas", ["Indicador", "Valor"], filasTotalesCultos(a));
  tabla("Cultos por zona", ENCABEZADOS_CULTOS_ZONA, filasCultosPorZona(a));
  tabla("VIS (hogares) y amigos", ["Indicador", "Valor"], filasTotalesPersonas(a));
  tabla("VIS (hogares) y amigos por zona", ENCABEZADOS_PERSONAS_ZONA, filasPersonasPorZona(a));
  if (personas) {
    const tipo = (p: (typeof personas)[number]) => (p.tipo === "integrante" ? `VIS · ${p.hogares?.familia ?? ""}` : "Amigo");
    tabla("Peticiones de oración", ["Nombre", "Tipo", "Zona", "Petición"], personas.filter((p) => p.pide_oracion).map((p) => [p.nombre, tipo(p), p.zonas?.nombre ?? "", p.peticion ?? ""]));
    tabla("Se entregaron a Cristo", ["Nombre", "Tipo", "Zona", "Registrado"], personas.filter((p) => p.entrego_vida).map((p) => [p.nombre, tipo(p), p.zonas?.nombre ?? "", p.creado_en.slice(0, 10)]));
    tabla("Enfermos", ["Nombre", "Tipo", "Zona", "Necesidad"], personas.filter((p) => p.enfermo).map((p) => [p.nombre, tipo(p), p.zonas?.nombre ?? "", p.calamidad ?? ""]));
  }
  doc.save(nombreArchivo("pdf", desde, hasta));
}
