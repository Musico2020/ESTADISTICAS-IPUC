import { describe, expect, it } from "vitest";
import { aParametrosHogar, hogarVacio, hayMenores, validarHogar, type DatosHogar } from "./validar";

const valido = (): DatosHogar => ({
  ...hogarVacio("z1"), familia: "Familia Pérez", direccion: "Calle 18 # 20-10",
  integrantes: [{ ...hogarVacio().integrantes[0], nombre: "Ana Pérez", edad: "34", parentesco: "Madre" }],
});

describe("validarHogar", () => {
  it("acepta un hogar completo con un adulto", () => {
    expect(validarHogar(valido())).toEqual({});
  });

  it("pide familia, dirección y zona", () => {
    const e = validarHogar({ ...valido(), familia: " ", direccion: "", zona_id: "" });
    expect(e.familia).toBeTruthy();
    expect(e.direccion).toBeTruthy();
    expect(e.zona_id).toBeTruthy();
  });

  it("exige al menos un integrante", () => {
    expect(validarHogar({ ...valido(), integrantes: [] }).integrantes).toBeTruthy();
  });

  it("marca el error en el integrante que corresponde", () => {
    const d = valido();
    d.integrantes.push({ ...d.integrantes[0], nombre: "", edad: "7.5", parentesco: "" });
    const e = validarHogar(d);
    expect(e.porIntegrante?.[0]).toEqual({});
    expect(e.porIntegrante?.[1].nombre).toBeTruthy();
    expect(e.porIntegrante?.[1].edad).toBeTruthy();
    expect(e.porIntegrante?.[1].parentesco).toBeTruthy();
  });

  it("con menores exige la autorización del adulto responsable", () => {
    const d = valido();
    d.integrantes.push({ ...d.integrantes[0], nombre: "Luis", edad: "8", parentesco: "Hijo" });
    expect(hayMenores(d)).toBe(true);
    expect(validarHogar(d).autorizacion_menores).toBeTruthy();
    expect(validarHogar({ ...d, autorizacion_menores: true })).toEqual({});
  });

  it("pide la petición si alguien pide oración", () => {
    const d = valido();
    d.integrantes[0].pide_oracion = true;
    expect(validarHogar(d).porIntegrante?.[0].peticion).toBeTruthy();
    expect(validarHogar({ ...valido(), pide_oracion: true }).peticion).toBeTruthy();
  });
});

describe("aParametrosHogar", () => {
  it("convierte la edad a número y vacíos a null", () => {
    const { p_hogar, p_integrantes } = aParametrosHogar(valido());
    expect(p_hogar.telefono).toBeNull();
    expect(p_hogar.id).toBeNull();
    expect(p_integrantes[0]).toMatchObject({ nombre: "Ana Pérez", edad: 34, parentesco: "Madre", telefono: null, id: null });
  });
});
