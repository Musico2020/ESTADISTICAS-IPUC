// Cada sección del sistema tiene su color de acento (ver globals.css, [data-seccion]).
export type Seccion = "evangelismo" | "cultos" | "vis" | "amigos" | "casos" | "informes" | "admin";

const PREFIJOS: [string, Seccion][] = [
  ["/cultos", "cultos"], ["/vis", "vis"], ["/amigos", "amigos"], ["/casos", "casos"],
  ["/estadisticas", "informes"], ["/informes", "informes"], ["/administracion", "admin"], ["/cuenta", "admin"],
];

export function seccionDe(ruta: string): Seccion {
  return PREFIJOS.find(([p]) => ruta === p || ruta.startsWith(p + "/"))?.[1] ?? "evangelismo";
}
