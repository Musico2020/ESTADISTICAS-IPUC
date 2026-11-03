import { describe, expect, it } from "vitest";
import { construirCasos, reporteVacio, validarReporte, type DatosReporte } from "./validar";

const valido = (c: Partial<DatosReporte> = {}): DatosReporte => ({
  ...reporteVacio(), zona_id: "z", responsable_nombre: "Ana", coordinador_nombre: "Luis", fecha_jornada: "2026-03-01",
  hogares_visitados: "12", personas_contactadas: "20", personas_aceptan_visita: "3", resultado_espiritual: "Oraron",
  receptividad: "4", dificultad: "ninguna", manzanas: ["m1"], ...c,
});

describe("validarReporte", () => {
  it("acepta un reporte completo, con más de 5 hogares", () => {
    expect(validarReporte(valido())).toEqual({});
  });
  it("exige al menos una manzana", () => {
    expect(validarReporte(valido({ manzanas: [] })).manzanas).toBeTruthy();
  });
  it("no exige manzanas en un reporte importado", () => {
    expect(validarReporte(valido({ manzanas: [], origen: "google_forms" })).manzanas).toBeUndefined();
  });
  it("rechaza números negativos o decimales", () => {
    expect(validarReporte(valido({ hogares_visitados: "-1" })).hogares_visitados).toBeTruthy();
    expect(validarReporte(valido({ personas_contactadas: "1.5" })).personas_contactadas).toBeTruthy();
  });
  it("exige descripción solo si hay un caso especial", () => {
    expect(validarReporte(valido()).descripcion_caso).toBeUndefined();
    expect(validarReporte(valido({ caso_enfermo: true })).descripcion_caso).toBeTruthy();
    expect(validarReporte(valido({ caso_enfermo: true, descripcion_caso: "Don Pedro" })).descripcion_caso).toBeUndefined();
  });
  it("exige la cantidad de niños solo si hubo evangelismo a niños", () => {
    expect(validarReporte(valido()).ninos_alcanzados).toBeUndefined();
    expect(validarReporte(valido({ evangelismo_ninos: true })).ninos_alcanzados).toBeTruthy();
    expect(validarReporte(valido({ evangelismo_ninos: true, ninos_alcanzados: "4" })).ninos_alcanzados).toBeUndefined();
  });
  it("exige detalle si la dificultad es Otra", () => {
    expect(validarReporte(valido({ dificultad: "otra" })).dificultad_otra).toBeTruthy();
  });
  it("no acepta fechas futuras", () => {
    expect(validarReporte(valido({ fecha_jornada: "2999-01-01" })).fecha_jornada).toBeTruthy();
  });
});

describe("construirCasos", () => {
  it("crea una fila por cada Sí, con la misma descripción", () => {
    const c = construirCasos(valido({ caso_enfermo: true, caso_sordo: true, descripcion_caso: "D" }));
    expect(c).toEqual([{ tipo: "enfermo", descripcion: "D" }, { tipo: "sordo", descripcion: "D" }]);
  });
  it("devuelve vacío si no hay casos", () => {
    expect(construirCasos(valido())).toEqual([]);
  });
});
