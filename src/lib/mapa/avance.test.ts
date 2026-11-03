import { describe, expect, it } from "vitest";
import { calcularAvance, colorManzana, COLOR_ALCANZADA, COLOR_SIN_PREDICAR } from "./avance";
import { periodoDeAnio } from "./periodo";
import type { Manzana } from "@/lib/tipos";

const g = { type: "Polygon" as const, coordinates: [] };
const m = (id: string, zona_id: string, activa = true): Manzana => ({ id, zona_id, codigo: id, geometria: g, activa });
const lista = [m("a", "z1"), m("b", "z1"), m("c", "z2"), m("x", "z1", false)];
const estados = [{ manzana_id: "a", ultima_fecha: "2026-01-01", jornadas: 2 }, { manzana_id: "x", ultima_fecha: "2026-01-01", jornadas: 1 }];

describe("calcularAvance", () => {
  it("cuenta solo manzanas activas", () => {
    expect(calcularAvance(lista, estados)).toEqual({ total: 3, alcanzadas: 1, porcentaje: 33 });
  });
  it("filtra por zona", () => {
    expect(calcularAvance(lista, estados, "z1")).toEqual({ total: 2, alcanzadas: 1, porcentaje: 50 });
  });
  it("no divide entre cero", () => {
    expect(calcularAvance([], [])).toEqual({ total: 0, alcanzadas: 0, porcentaje: 0 });
  });
});

describe("colorManzana", () => {
  it("verde si fue alcanzada y rojo si no", () => {
    expect(colorManzana(true)).toBe(COLOR_ALCANZADA);
    expect(colorManzana(false)).toBe(COLOR_SIN_PREDICAR);
  });
});

describe("periodoDeAnio", () => {
  it("cubre el año completo", () => {
    expect(periodoDeAnio(2026)).toEqual({ desde: "2026-01-01", hasta: "2026-12-31" });
  });
});
