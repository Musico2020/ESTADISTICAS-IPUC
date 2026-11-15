import { describe, expect, it } from "vitest";
import { enZonas, filtrarPorSituacion, rangoDe, zonasFiltradas } from "./capas";
import type { Zona } from "@/lib/tipos";

const g = { type: "Polygon" as const, coordinates: [] };
const z = (id: string, sector_id: string): Zona => ({ id, sector_id, numero: 1, nombre: id, color_borde: "#000", geometria: g });
const zonas = [z("z1", "s1"), z("z2", "s1"), z("z4", "s2")];

describe("rangoDe", () => {
  const hoy = new Date("2026-02-10T12:00:00Z");
  it("calcula el mes y el año actuales", () => {
    expect(rangoDe("mes", hoy)).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(rangoDe("anio", hoy)).toEqual({ desde: "2026-01-01", hasta: "2026-12-31" });
  });
  it("usa el rango solo si es válido y si no muestra todo", () => {
    expect(rangoDe("rango", hoy, "2026-01-05", "2026-01-20")).toEqual({ desde: "2026-01-05", hasta: "2026-01-20" });
    expect(rangoDe("rango", hoy, "2026-03-01", "2026-01-01").desde).toBe("2000-01-01");
  });
});

describe("zonasFiltradas y enZonas", () => {
  it("la zona manda sobre el sector", () => {
    expect(zonasFiltradas(zonas, "s1", "z4").map((x) => x.id)).toEqual(["z4"]);
    expect(zonasFiltradas(zonas, "s1", "").map((x) => x.id)).toEqual(["z1", "z2"]);
    expect(zonasFiltradas(zonas, "", "")).toHaveLength(3);
  });
  it("deja solo las filas de esas zonas", () => {
    expect(enZonas([{ zona_id: "z1" }, { zona_id: "z4" }], zonasFiltradas(zonas, "s2", ""))).toEqual([{ zona_id: "z4" }]);
  });
});

describe("filtrarPorSituacion", () => {
  const p = (c: Partial<{ enfermo: boolean; pide_oracion: boolean; entrego_vida: boolean }>) =>
    ({ zona_id: "z1", tipo: "amigo" as const, enfermo: false, pide_oracion: false, entrego_vida: false, ...c });
  const personas = [p({ enfermo: true }), p({ pide_oracion: true })];
  const cultos = [{ zona_id: "z1", hubo_enfermos: true }, { zona_id: "z1", hubo_enfermos: false }];
  it("sin filtro deja todo", () => {
    expect(filtrarPorSituacion(personas, cultos, "")).toEqual({ personas, cultos });
  });
  it("enfermos incluye los cultos con enfermos", () => {
    const r = filtrarPorSituacion(personas, cultos, "enfermo");
    expect(r.personas).toHaveLength(1);
    expect(r.cultos).toEqual([cultos[0]]);
  });
  it("oración no aplica a cultos", () => {
    expect(filtrarPorSituacion(personas, cultos, "pide_oracion").cultos).toEqual([]);
  });
});
