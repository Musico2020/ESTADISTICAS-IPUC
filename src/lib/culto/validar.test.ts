import { describe, expect, it } from "vitest";
import { aFilaCulto, cultoVacio, pesos, validarCulto, type DatosCulto } from "./validar";

const valido = (c: Partial<DatosCulto> = {}): DatosCulto => ({
  ...cultoVacio("z1"), fecha: "2026-11-11", direccion: "Calle 18B # 19-30", lat: 10.46, lon: -73.25, precision_m: 8,
  hermanos: "12", amigos: "3", ninos: "4", ofrenda: "50.000", ...c,
});

describe("pesos", () => {
  it("acepta valores con o sin puntos de miles", () => {
    expect(pesos("50000")).toBe(50000);
    expect(pesos("50.000")).toBe(50000);
    expect(pesos("$ 1.250.000")).toBe(1250000);
    expect(pesos("")).toBe(0);
  });
  it("rechaza decimales y texto", () => {
    expect(pesos("50,5")).toBeNull();
    expect(pesos("cincuenta")).toBeNull();
    expect(pesos("5.00")).toBeNull();
  });
});

describe("validarCulto", () => {
  it("acepta un culto completo", () => {
    expect(validarCulto(valido())).toEqual({});
  });
  it("exige la ubicación de la casa", () => {
    expect(validarCulto(valido({ lat: null, lon: null })).ubicacion).toBeTruthy();
  });
  it("exige dirección y números enteros", () => {
    const e = validarCulto(valido({ direccion: " ", hermanos: "-1", amigos: "2.5" }));
    expect(e.direccion).toBeTruthy();
    expect(e.hermanos).toBeTruthy();
    expect(e.amigos).toBeTruthy();
  });
  it("no acepta fechas futuras", () => {
    expect(validarCulto(valido({ fecha: "2999-01-01" })).fecha).toBeTruthy();
  });
});

describe("aFilaCulto", () => {
  it("convierte los textos en números y descarta la oración si no hubo enfermos", () => {
    const f = aFilaCulto(valido({ se_oro_enfermos: true }));
    expect(f).toMatchObject({ hermanos: 12, amigos: 3, ninos: 4, ofrenda: 50000, se_oro_enfermos: false, observaciones: null });
  });
});
