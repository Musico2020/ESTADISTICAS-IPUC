import { describe, expect, it } from "vitest";
import { filasPorZona, nombreArchivo } from "./resumen";

describe("filasPorZona", () => {
  it("calcula el porcentaje por zona", () => {
    const f = filasPorZona({ por_zona: [{ numero: 1, nombre: "Zona 1", manzanas_total: 40, manzanas_alcanzadas: 10, jornadas: 3, personas: 50 }] } as never);
    expect(f).toEqual([["Zona 1", 3, 50, 10, 40, "25%"]]);
  });
  it("no falla con una zona sin manzanas", () => {
    const f = filasPorZona({ por_zona: [{ numero: 2, nombre: "Zona 2", manzanas_total: 0, manzanas_alcanzadas: 0, jornadas: 0, personas: 0 }] } as never);
    expect(f[0][5]).toBe("0%");
  });
});

describe("nombreArchivo", () => {
  it("incluye el período", () => {
    expect(nombreArchivo("pdf", "2026-01-01", "2026-12-31")).toBe("informe-evangelismo-2026-01-01-a-2026-12-31.pdf");
  });
});
