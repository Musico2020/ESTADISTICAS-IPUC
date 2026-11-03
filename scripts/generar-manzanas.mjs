import fs from "node:fs";
import * as turf from "@turf/turf";

const VIAS_DESCARTADAS = new Set(["footway", "path", "cycleway", "track", "service", "construction", "steps"]);
const AREA_MIN_M2 = 400;
const AREA_MAX_M2 = 40000;
const FRACCION_MIN = 0.45;
const COMPACIDAD_MIN = 0.2;
const SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const CONSULTA = '[out:json][timeout:60];way["highway"](10.452,-73.278,10.472,-73.248);out tags geom;';

// Las vías se guardan en data/vias-osm.json; bórrelo para descargar datos más recientes.
const ARCHIVO_VIAS = "data/vias-osm.json";

async function descargarVias() {
  if (fs.existsSync(ARCHIVO_VIAS)) return JSON.parse(fs.readFileSync(ARCHIVO_VIAS, "utf8")).elements;
  for (const url of SERVIDORES) {
    const r = await fetch(url, { method: "POST", headers: { "User-Agent": "estadisticas-ipuc/1.0" }, body: new URLSearchParams({ data: CONSULTA }) });
    if (r.ok) {
      const texto = await r.text();
      fs.writeFileSync(ARCHIVO_VIAS, texto);
      return JSON.parse(texto).elements;
    }
    console.warn(`Overpass ${url}: HTTP ${r.status}`);
  }
  throw new Error("Ningún servidor de Overpass respondió");
}

const { transformacion: t, zonas } = JSON.parse(fs.readFileSync("data/zonas-pixeles.json", "utf8"));
// La imagen está levemente girada: x = x0 + sx*dLon + rx*dLat, y = y0 - sy*dLat + ry*dLon.
// Un vértice es un píxel de la imagen [x, y] o una coordenada exacta { lat, lon } tomada de una calle.
const aLonLat = (v) => {
  if (!Array.isArray(v)) return [v.lon, v.lat];
  const [x, y] = v;
  const X = x - t.x0, Y = y - t.y0, det = -t.sx * t.sy - t.rx * t.ry;
  return [t.lon0 + (-t.sy * X - t.rx * Y) / det, t.lat0 + (-t.ry * X + t.sx * Y) / det];
};
const redondear = (n) => Math.round(n * 1e6) / 1e6;

const zonasGeo = zonas.map((z) => {
  const anillo = z.pixeles.map(aLonLat).map(([a, b]) => [redondear(a), redondear(b)]);
  return { numero: z.numero, nombre: z.nombre, color_borde: z.color_borde,
           geometria: { type: "Polygon", coordinates: [[...anillo, anillo[0]]] } };
});

// Cada manzana es una cara cerrada de la red de calles. OSM comparte nodos en los cruces, así que
// sus coordenadas identifican el grafo. Las calles sin salida se podan porque no cierran manzanas.
function trazarManzanas(vias) {
  const vecinos = new Map();
  const unir = (a, b) => { if (!vecinos.has(a)) vecinos.set(a, new Set()); vecinos.get(a).add(b); };
  for (const v of vias) {
    for (let i = 1; i < v.geometry.length; i++) {
      const a = `${v.geometry[i - 1].lon},${v.geometry[i - 1].lat}`, b = `${v.geometry[i].lon},${v.geometry[i].lat}`;
      if (a !== b) { unir(a, b); unir(b, a); }
    }
  }
  for (let cambio = true; cambio;) {
    cambio = false;
    for (const [n, conj] of vecinos) {
      if (conj.size > 1) continue;
      for (const o of conj) vecinos.get(o).delete(n);
      vecinos.delete(n);
      cambio = true;
    }
  }
  const punto = (k) => k.split(",").map(Number);
  const orden = new Map();
  for (const [n, conj] of vecinos) {
    const [x, y] = punto(n);
    const angulo = (k) => { const [a, b] = punto(k); return Math.atan2(b - y, (a - x) * Math.cos((y * Math.PI) / 180)); };
    orden.set(n, [...conj].sort((p, q) => angulo(p) - angulo(q)));
  }
  const vistos = new Set();
  const caras = [];
  for (const [inicio, lista] of orden) {
    for (const siguiente of lista) {
      let u = inicio, v = siguiente;
      const anillo = [];
      while (!vistos.has(`${u}|${v}`)) {
        vistos.add(`${u}|${v}`);
        anillo.push(punto(u));
        const l = orden.get(v);
        const w = l[(l.indexOf(u) - 1 + l.length) % l.length];
        u = v; v = w;
      }
      if (anillo.length < 3) continue;
      let doble = 0;
      anillo.forEach(([x1, y1], i) => { const [x2, y2] = anillo[(i + 1) % anillo.length]; doble += x1 * y2 - x2 * y1; });
      if (doble > 0) caras.push(turf.polygon([[...anillo, anillo[0]]]));
    }
  }
  return caras;
}

const elementos = await descargarVias();
const viasUtiles = elementos.filter((e) => e.type === "way" && !VIAS_DESCARTADAS.has(e.tags.highway));
const nodosGlorieta = new Set(viasUtiles.filter((v) => v.tags.junction).flatMap((v) => v.geometry.map((g) => `${g.lon},${g.lat}`)));
// El centro de una glorieta no es una manzana.
const poligonos = trazarManzanas(viasUtiles).filter((p) => !p.geometry.coordinates[0].every(([x, y]) => nodosGlorieta.has(`${x},${y}`)));

// Una manzana pertenece a la zona que contiene la mayor parte de su área, si supera FRACCION_MIN.
function zonaDeManzana(p, area) {
  let mejor = null, mayor = FRACCION_MIN;
  for (const z of zonasGeo) {
    const comun = turf.intersect(turf.featureCollection([p, turf.feature(z.geometria)]));
    const fraccion = comun ? turf.area(comun) / area : 0;
    if (fraccion > mayor) { mayor = fraccion; mejor = z; }
  }
  return mejor;
}

const contadores = new Map();
const manzanas = [];
let descartadas = 0;
for (const p of poligonos) {
  const area = turf.area(p);
  if (area < AREA_MIN_M2 || area > AREA_MAX_M2) { descartadas++; continue; }
  const perimetro = turf.length(turf.polygonToLine(p), { units: "meters" });
  if ((4 * Math.PI * area) / perimetro ** 2 < COMPACIDAD_MIN) { descartadas++; continue; }
  const zona = zonaDeManzana(p, area);
  if (!zona) continue;
  const n = (contadores.get(zona.numero) ?? 0) + 1;
  contadores.set(zona.numero, n);
  manzanas.push({ codigo: `Z${zona.numero}-${String(n).padStart(3, "0")}`, zona_numero: zona.numero,
    geometria: { type: "Polygon", coordinates: p.geometry.coordinates.map((a) => a.map(([x, y]) => [redondear(x), redondear(y)])) } });
}

fs.mkdirSync("supabase/seed", { recursive: true });
fs.writeFileSync("supabase/seed/zonas.json", JSON.stringify(zonasGeo));
fs.writeFileSync("supabase/seed/manzanas.json", JSON.stringify(manzanas));
fs.writeFileSync("public/revision.html", `<!doctype html><meta charset="utf-8"><title>Revisión de manzanas</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0}</style><div id="m"></div><script>
const Z=${JSON.stringify(zonasGeo)},M=${JSON.stringify(manzanas)};
const m=L.map('m');L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(m);
const g=L.featureGroup(Z.map(z=>L.geoJSON(z.geometria,{style:{color:z.color_borde,weight:4,fill:false}}))).addTo(m);
M.forEach(a=>L.geoJSON(a.geometria,{style:{color:'#555',weight:1,fillColor:'#ef4444',fillOpacity:.35}}).bindTooltip(a.codigo).addTo(m));
m.fitBounds(g.getBounds());</script>`);
console.log("Manzanas por zona:", Object.fromEntries(contadores), "| descartadas por área:", descartadas, "| total:", manzanas.length);
