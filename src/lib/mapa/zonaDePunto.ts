import type { Area } from "@/lib/tipos";

// Regla del rayo: cuenta cuántas veces una línea horizontal desde el punto cruza el borde.
function enAnillo(lon: number, lat: number, anillo: number[][]) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

const enPoligono = (lon: number, lat: number, anillos: number[][][]) =>
  enAnillo(lon, lat, anillos[0]) && !anillos.slice(1).some((hueco) => enAnillo(lon, lat, hueco));

export function contiene(area: Area, lat: number, lon: number) {
  return area.type === "Polygon"
    ? enPoligono(lon, lat, area.coordinates)
    : area.coordinates.some((p) => enPoligono(lon, lat, p));
}

export function zonaDePunto<T extends { id: string; geometria: Area }>(zonas: T[], lat: number, lon: number) {
  return zonas.find((z) => contiene(z.geometria, lat, lon)) ?? null;
}
