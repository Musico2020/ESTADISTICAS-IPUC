import { describe, expect, it } from "vitest";
import { eligeZona, puedeCorregir, zonasPermitidas } from "./roles";
import type { Rol } from "./tipos";

const zonas = [
  { id: "z1", sector_id: "s1" }, { id: "z2", sector_id: "s1" }, { id: "z4", sector_id: "s2" },
];
const p = (rol: Rol, extra: { zona_id?: string; sector_id?: string } = {}) =>
  ({ id: "yo", rol, zona_id: extra.zona_id ?? null, sector_id: extra.sector_id ?? null });

describe("zonasPermitidas", () => {
  it("el superusuario y la cuenta compartida ven todas", () => {
    expect(zonasPermitidas(p("administrador"), zonas)).toHaveLength(3);
    expect(zonasPermitidas(p("usuario"), zonas)).toHaveLength(3);
  });
  it("el coordinador de sector ve las zonas de su sector", () => {
    expect(zonasPermitidas(p("coordinador_sector", { sector_id: "s1" }), zonas).map((z) => z.id)).toEqual(["z1", "z2"]);
  });
  it("coordinador y líder de zona ven solo su zona", () => {
    expect(zonasPermitidas(p("coordinador_zona", { zona_id: "z2" }), zonas).map((z) => z.id)).toEqual(["z2"]);
    expect(zonasPermitidas(p("lider_zona", { zona_id: "z4" }), zonas).map((z) => z.id)).toEqual(["z4"]);
  });
});

describe("eligeZona", () => {
  it("solo quien tiene varias zonas elige", () => {
    expect(eligeZona(p("coordinador_sector", { sector_id: "s1" }))).toBe(true);
    expect(eligeZona(p("lider_zona", { zona_id: "z1" }))).toBe(false);
  });
});

describe("puedeCorregir", () => {
  it("el coordinador de sector corrige en su sector y no en otro", () => {
    const c = p("coordinador_sector", { sector_id: "s1" });
    expect(puedeCorregir(c, zonas[1], "otro")).toBe(true);
    expect(puedeCorregir(c, zonas[2], "otro")).toBe(false);
  });
  it("el coordinador de zona corrige lo de otros en su zona", () => {
    expect(puedeCorregir(p("coordinador_zona", { zona_id: "z1" }), zonas[0], "otro")).toBe(true);
  });
  it("el líder solo corrige lo suyo", () => {
    const l = p("lider_zona", { zona_id: "z1" });
    expect(puedeCorregir(l, zonas[0], "yo")).toBe(true);
    expect(puedeCorregir(l, zonas[0], "otro")).toBe(false);
    expect(puedeCorregir(l, zonas[1], "yo")).toBe(false);
  });
});
