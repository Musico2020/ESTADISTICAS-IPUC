import { describe, expect, it } from "vitest";
import { aCorreo } from "./usuarios";

describe("aCorreo", () => {
  it("convierte un nombre de usuario en correo interno", () => {
    expect(aCorreo("admin")).toBe("admin@usuarios-ipuc.example.com");
  });
  it("ignora mayúsculas y espacios", () => {
    expect(aCorreo("  Admin ")).toBe("admin@usuarios-ipuc.example.com");
  });
  it("deja igual un correo completo", () => {
    expect(aCorreo("Ana@ejemplo.org")).toBe("ana@ejemplo.org");
  });
});
