import { describe, expect, it } from "vitest";
import { aFilaPersona, personaVacia, telefonoValido, validarPersona, type DatosPersona } from "./validar";

const amigo = (c: Partial<DatosPersona> = {}): DatosPersona => ({ ...personaVacia("z1"), nombre: "Carlos", ...c });

describe("validarPersona", () => {
  it("solo exige nombre y zona", () => {
    expect(validarPersona(amigo())).toEqual({});
    expect(validarPersona(amigo({ nombre: "", zona_id: "" }))).toMatchObject({ nombre: expect.any(String), zona_id: expect.any(String) });
  });
  it("exige la petición si pide oración", () => {
    expect(validarPersona(amigo({ pide_oracion: true })).peticion).toBeTruthy();
    expect(validarPersona(amigo({ pide_oracion: true, peticion: "Por su salud" })).peticion).toBeUndefined();
  });
  it("revisa el teléfono y la edad solo si se escriben", () => {
    expect(validarPersona(amigo({ telefono: "300 123 4567" })).telefono).toBeUndefined();
    expect(validarPersona(amigo({ telefono: "12" })).telefono).toBeTruthy();
    expect(validarPersona(amigo({ edad: "7.5" })).edad).toBeTruthy();
  });
});

describe("telefonoValido", () => {
  it("acepta formatos colombianos comunes", () => {
    for (const t of ["3001234567", "+57 300 123 4567", "605-5712345", "5712345"]) expect(telefonoValido(t)).toBe(true);
  });
});

describe("aFilaPersona", () => {
  it("descarta la petición si no pide oración y deja la edad vacía como null", () => {
    expect(aFilaPersona(amigo({ peticion: "x" }))).toMatchObject({ tipo: "amigo", peticion: null, edad: null });
  });
});
