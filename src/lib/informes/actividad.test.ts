import { describe, expect, it } from "vitest";
import { filasCultosPorZona, filasPersonasPorZona, filasTotalesCultos, type ResumenActividad } from "./actividad";

const zona = (numero: number, c: Partial<ResumenActividad["por_zona"][number]> = {}) => ({
  numero, nombre: `Zona ${numero}`, cultos: 0, hermanos: 0, amigos: 0, ofrenda: 0, vis: 0, fichas_amigos: 0, entregaron: 0, oracion: 0, visitas: 0, ...c,
});
const r: ResumenActividad = {
  cultos: { total: 3, hermanos: 30, amigos: 6, ninos: 4, ofrenda: 150000, con_enfermos: 1, se_oro: 1, miercoles: 2, viernes: 1 },
  personas: { vis: 2, amigos: 1, enfermos: 1, piden_oracion: 2, entregaron: 1, congregados: 0 },
  visitas: 4,
  por_zona: [zona(1, { cultos: 3, hermanos: 30, amigos: 6, ofrenda: 150000 }), zona(2), zona(3, { vis: 2, visitas: 4 })],
  por_mes: [],
};

describe("filas de actividad", () => {
  it("lista solo las zonas con cultos, con la ofrenda en pesos", () => {
    expect(filasCultosPorZona(r)).toEqual([["Zona 1", 3, 30, 6, "$ 150.000"]]);
  });
  it("lista solo las zonas con hogares, fichas o visitas", () => {
    expect(filasPersonasPorZona(r)).toEqual([["Zona 3", 2, 0, 0, 0, 0, 4]]);
  });
  it("los totales de cultos incluyen miércoles, viernes y ofrenda", () => {
    const t = Object.fromEntries(filasTotalesCultos(r));
    expect(t).toMatchObject({ "Los miércoles": 2, "Los viernes": 1, Ofrenda: "$ 150.000" });
  });
});
