import { describe, expect, it } from "vitest";
import { traducirFila } from "./leer";

const zonas = [{ id: "z1", numero: 1 }];
const fila = (c: Record<string, unknown> = {}) => ({
  "Marca temporal": "15/03/2026 10:00:00", "Nombre completo ": "Ana Díaz", "  Zona / Bloque asignado  ": "Zona 1",
  "  Nombre del coordinador de zona  ": "Luis", "  Fecha de la jornada evangelística   ": "2026-03-15",
  "  Manzana(s) trabajada(s)  ": "Calle 16 # 20", "  Cantidad de hogares visitados  ": "5",
  "  Cantidad de personas contactadas  ": "8", "  Personas que aceptaron visita posterior  ": "2",
  "  Breve descripción del resultado espiritual  ": "Oraron",
  "  ¿Se encontró alguna persona enferma que requiera visita hospitalaria?  ": "No",
  "  ¿Se identificó alguna persona sorda?  ": "No",
  "  ¿Se detectó algún caso que requiera consejería o visitación especial?  ": "No",
  "  Si respondió SÍ a alguna anterior, describa brevemente el caso  ": "N/A",
  "  ¿Se realizó evangelismo a niños en la zona?  ": "No", "  Cantidad aproximada de niños alcanzados  ": "0",
  "  ¿Cómo evalúa la receptividad del sector?  ": "4", "  Dificultades encontradas durante la jornada  ": "Poco tiempo",
  "  Sugerencias para mejorar el trabajo en esta zona  ": "Más gente", ...c,
});

describe("traducirFila", () => {
  it("traduce una fila válida ignorando espacios en encabezados", async () => {
    const r = await traducirFila(fila(), zonas);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.reporte).toMatchObject({ zona_id: "z1", responsable_nombre: "Ana Díaz", fecha_jornada: "2026-03-15",
      direccion: "Calle 16 # 20", hogares_visitados: 5, personas_aceptan_visita: 2, dificultad: "poco_tiempo", receptividad: 4 });
    expect(r.reporte.huella_importacion).toMatch(/^[0-9a-f]{64}$/);
    expect(r.casos).toEqual([]);
  });
  it("rechaza una zona inválida", async () => {
    const r = await traducirFila(fila({ "  Zona / Bloque asignado  ": "Zona 9" }), zonas);
    expect(r.ok).toBe(false);
  });
  it("rechaza una fecha inválida y acepta el formato dd/mm/aaaa", async () => {
    expect((await traducirFila(fila({ "  Fecha de la jornada evangelística   ": "ayer" }), zonas)).ok).toBe(false);
    const r = await traducirFila(fila({ "  Fecha de la jornada evangelística   ": "15/03/2026" }), zonas);
    expect(r.ok && r.reporte.fecha_jornada).toBe("2026-03-15");
  });
  it("guarda como nombres un texto en personas que aceptaron visita", async () => {
    const r = await traducirFila(fila({ "  Personas que aceptaron visita posterior  ": "Juan y Rosa" }), zonas);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.reporte.personas_aceptan_visita).toBeNull();
    expect(r.reporte.nombres_visita).toBe("Juan y Rosa");
  });
  it("deja vacío y advierte un número que no lo es", async () => {
    const r = await traducirFila(fila({ "  Cantidad de personas contactadas  ": "varias" }), zonas);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.reporte.personas_contactadas).toBeNull();
    expect(r.advertencias.join()).toMatch(/personas contactadas/i);
  });
  it("crea un caso por cada Sí", async () => {
    const r = await traducirFila(fila({ "  ¿Se identificó alguna persona sorda?  ": "Si",
      "  Si respondió SÍ a alguna anterior, describa brevemente el caso  ": "Vecina" }), zonas);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.casos).toEqual([{ tipo: "sordo", descripcion: "Vecina" }]);
  });
  it("trata una dificultad desconocida como otra", async () => {
    const r = await traducirFila(fila({ "  Dificultades encontradas durante la jornada  ": "Lluvia y barro" }), zonas);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.reporte).toMatchObject({ dificultad: "otra", dificultad_otra: "Lluvia y barro" });
  });
  it("la misma fila produce la misma huella", async () => {
    const a = await traducirFila(fila(), zonas), b = await traducirFila(fila(), zonas);
    expect(a.ok && b.ok && a.reporte.huella_importacion === b.reporte.huella_importacion).toBe(true);
  });
});
