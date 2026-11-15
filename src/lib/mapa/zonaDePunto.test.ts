import { describe, expect, it } from "vitest";
import { zonaDePunto } from "./zonaDePunto";
import type { Area } from "@/lib/tipos";

const cuadro = (x: number, y: number, t = 1): number[][] => [[x, y], [x + t, y], [x + t, y + t], [x, y + t], [x, y]];
const zonas: { id: string; geometria: Area }[] = [
  { id: "a", geometria: { type: "Polygon", coordinates: [cuadro(0, 0, 4), cuadro(1, 1, 1)] } },
  { id: "b", geometria: { type: "MultiPolygon", coordinates: [[cuadro(10, 0)], [cuadro(20, 0)]] } },
];

describe("zonaDePunto", () => {
  it("encuentra la zona que contiene el punto (lat, lon)", () => {
    expect(zonaDePunto(zonas, 3, 3)?.id).toBe("a");
    expect(zonaDePunto(zonas, 0.5, 20.5)?.id).toBe("b");
  });
  it("respeta los huecos y devuelve null fuera de todas", () => {
    expect(zonaDePunto(zonas, 1.5, 1.5)).toBeNull();
    expect(zonaDePunto(zonas, 50, 50)).toBeNull();
  });
});
