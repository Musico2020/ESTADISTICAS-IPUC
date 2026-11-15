import { describe, expect, it } from "vitest";
import { aFilaPersona, personaVacia, telefonoValido, validarPersona, type DatosPersona } from "./validar";

const nino = (c: Partial<DatosPersona> = {}): DatosPersona => ({
  ...personaVacia("nino_vis", "z1"), nombre: "Sofía", edad: "8", acudiente: "Marta, madre", autorizacion_acudiente: true, ...c,
});
const amigo = (c: Partial<DatosPersona> = {}): DatosPersona => ({ ...personaVacia("amigo", "z1"), nombre: "Carlos", ...c });

describe("validarPersona: VIS", () => {
  it("acepta una ficha completa", () => {
    expect(validarPersona(nino())).toEqual({});
  });
  it("exige la autorización del acudiente", () => {
    expect(validarPersona(nino({ autorizacion_acudiente: false })).autorizacion_acudiente).toBeTruthy();
  });
  it("exige edad de menor y acudiente", () => {
    expect(validarPersona(nino({ edad: "" })).edad).toBeTruthy();
    expect(validarPersona(nino({ edad: "18" })).edad).toMatch(/amigo/);
    expect(validarPersona(nino({ acudiente: " " })).acudiente).toBeTruthy();
  });
});

describe("validarPersona: amigos", () => {
  it("solo exige nombre y zona", () => {
    expect(validarPersona(amigo())).toEqual({});
    expect(validarPersona(amigo({ nombre: "", zona_id: "" }))).toMatchObject({ nombre: expect.any(String), zona_id: expect.any(String) });
  });
  it("exige la petición si pide oración", () => {
    expect(validarPersona(amigo({ pide_oracion: true })).peticion).toBeTruthy();
    expect(validarPersona(amigo({ pide_oracion: true, peticion: "Por su salud" })).peticion).toBeUndefined();
  });
  it("revisa el teléfono solo si se escribe", () => {
    expect(validarPersona(amigo({ telefono: "300 123 4567" })).telefono).toBeUndefined();
    expect(validarPersona(amigo({ telefono: "12" })).telefono).toBeTruthy();
  });
});

describe("telefonoValido", () => {
  it("acepta formatos colombianos comunes", () => {
    for (const t of ["3001234567", "+57 300 123 4567", "605-5712345", "5712345"]) expect(telefonoValido(t)).toBe(true);
  });
});

describe("aFilaPersona", () => {
  it("guarda la autorización solo para VIS y descarta la petición si no pide oración", () => {
    expect(aFilaPersona(amigo({ autorizacion_acudiente: true, peticion: "x" }))).toMatchObject({ autorizacion_acudiente: false, peticion: null, edad: null });
    expect(aFilaPersona(nino())).toMatchObject({ autorizacion_acudiente: true, edad: 8 });
  });
});
