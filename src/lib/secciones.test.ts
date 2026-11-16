import { describe, expect, it } from "vitest";
import { seccionDe } from "./secciones";

describe("seccionDe", () => {
  it("asigna el color por la ruta", () => {
    expect(seccionDe("/cultos/nuevo")).toBe("cultos");
    expect(seccionDe("/vis/abc")).toBe("vis");
    expect(seccionDe("/amigos")).toBe("amigos");
    expect(seccionDe("/informes")).toBe("informes");
    expect(seccionDe("/administracion")).toBe("admin");
  });
  it("usa evangelismo para mapa, reportes y rutas desconocidas", () => {
    expect(seccionDe("/mapa")).toBe("evangelismo");
    expect(seccionDe("/reportes/1")).toBe("evangelismo");
    expect(seccionDe("/visitas")).toBe("evangelismo");
  });
});
