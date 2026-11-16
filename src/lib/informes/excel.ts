import ExcelJS from "exceljs";
import { ETIQUETA_CASO, ETIQUETA_DIFICULTAD, type Dificultad, type TipoCaso } from "@/lib/tipos";
import type { DatosInforme } from "./datos";
import { DIAS } from "@/lib/culto/validar";
import { ETIQUETA_ESTADO, type EstadoSeguimiento } from "@/lib/persona/validar";
import { filasPorZona, nombreArchivo } from "./resumen";
import { textoSeguro } from "./seguro";

function hoja(libro: ExcelJS.Workbook, nombre: string, encabezados: string[], filas: (string | number | null)[][]) {
  const h = libro.addWorksheet(nombre);
  h.addRow(encabezados).font = { bold: true };
  filas.forEach((f) => h.addRow(f.map((v) => (typeof v === "string" ? textoSeguro(v) : v))));
  h.columns.forEach((c) => { c.width = 20; });
  h.views = [{ state: "frozen", ySplit: 1 }];
}

export async function generarExcel({ estadisticas: e, reportes, casos, actividad, cultos, personas, visitas, hogares, desde, hasta }: DatosInforme) {
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
  const si = (v: boolean) => (v ? "Sí" : "No");
  hoja(libro, "Cultos", ["Fecha", "Día", "Zona", "Dirección", "Hermanos", "Amigos", "Niños", "Ofrenda", "Hubo enfermos", "Se oró", "Observaciones"],
    cultos.map((c) => [c.fecha, DIAS[c.dia_semana], c.zonas?.nombre ?? "", c.direccion, c.hermanos, c.amigos, c.ninos, c.ofrenda, si(c.hubo_enfermos), si(c.se_oro_enfermos), c.observaciones]));
  hoja(libro, "Actividad por zona", ["Zona", "Cultos", "Hermanos", "Amigos en cultos", "Ofrenda", "Hogares VIS", "Personas en hogares", "Fichas de amigos", "Se entregaron", "Piden oración", "Visitas"],
    actividad.por_zona.map((z) => [z.nombre, z.cultos, z.hermanos, z.amigos, z.ofrenda, z.vis, z.integrantes ?? 0, z.fichas_amigos, z.entregaron, z.oracion, z.visitas]));
  if (hogares) {
    hoja(libro, "Hogares VIS", ["Registrado", "Zona", "Familia", "Dirección", "Teléfono", "Recibió la visita", "Integrantes", "Menores", "Calamidad o necesidad", "Pide oración", "Petición", "Seguimiento", "Notas"],
      hogares.map((h) => [h.creado_en.slice(0, 10), h.zonas?.nombre ?? "", h.familia, h.direccion, h.telefono, h.atendio, h.personas.length,
        h.personas.filter((p) => p.edad !== null && p.edad < 18).length, h.calamidad, si(h.pide_oracion), h.peticion,
        ETIQUETA_ESTADO[h.estado_seguimiento as EstadoSeguimiento] ?? h.estado_seguimiento, h.notas]));
  }
  if (personas) {
    const seguimiento = (p: (typeof personas)[number]) => ETIQUETA_ESTADO[p.estado_seguimiento as EstadoSeguimiento] ?? p.estado_seguimiento;
    hoja(libro, "Integrantes VIS", ["Registrado", "Zona", "Familia", "Nombre", "Parentesco", "Edad", "Teléfono", "Enfermo", "Pide oración", "Petición", "Se entregó a Cristo", "Seguimiento"],
      personas.filter((p) => p.tipo === "integrante").map((p) => [p.creado_en.slice(0, 10), p.zonas?.nombre ?? "", p.hogares?.familia ?? "", p.nombre, p.parentesco, p.edad, p.telefono,
        si(p.enfermo), si(p.pide_oracion), p.peticion, si(p.entrego_vida), seguimiento(p)]));
    hoja(libro, "Amigos", ["Registrado", "Zona", "Nombre", "Edad", "Teléfono", "Familia", "Dirección", "Necesidad", "Enfermo", "Pide oración", "Petición", "Se entregó a Cristo", "Seguimiento", "Notas"],
      personas.filter((p) => p.tipo === "amigo").map((p) => [p.creado_en.slice(0, 10), p.zonas?.nombre ?? "", p.nombre, p.edad, p.telefono, p.familia, p.direccion,
        p.calamidad, si(p.enfermo), si(p.pide_oracion), p.peticion, si(p.entrego_vida), seguimiento(p), p.notas]));
  }
  if (visitas) {
    hoja(libro, "Visitas", ["Fecha", "Zona", "Visitado", "Tipo", "Notas"],
      visitas.map((v) => [v.fecha, v.zonas?.nombre ?? "", v.hogares?.familia ?? v.personas?.nombre ?? "", v.hogares ? "Hogar VIS" : "Amigo", v.notas]));
  }
  const b = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([b], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo("xlsx", desde, hasta);
  a.click();
  URL.revokeObjectURL(url);
}
