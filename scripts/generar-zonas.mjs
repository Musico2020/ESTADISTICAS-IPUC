import fs from "node:fs";
import * as turf from "@turf/turf";

// Divide cada sector en ZONAS_POR_SECTOR zonas de manzanas contiguas.
// Entrada: supabase/seed/sectores.json y manzanas.json (con sector_numero), de generar-manzanas.mjs.
// Salida: supabase/seed/zonas.json y manzanas.json con zona_numero y código nuevos.
const ZONAS_POR_SECTOR = 3;
// El orden de las franjas sigue el eje largo del sector; data/zonas-ajustes.json permite mover manzanas a mano.
const AJUSTES = fs.existsSync("data/zonas-ajustes.json") ? JSON.parse(fs.readFileSync("data/zonas-ajustes.json", "utf8")) : {};

const sectores = JSON.parse(fs.readFileSync("supabase/seed/sectores.json", "utf8"));
const manzanas = JSON.parse(fs.readFileSync("supabase/seed/manzanas.json", "utf8"));

function ejeLargo(puntos) {
  const n = puntos.length;
  const mx = puntos.reduce((a, p) => a + p[0], 0) / n, my = puntos.reduce((a, p) => a + p[1], 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of puntos) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const angulo = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return [Math.cos(angulo), Math.sin(angulo)];
}

const zonas = [];
const resultado = [];
for (const s of sectores) {
  const propias = manzanas.filter((m) => m.sector_numero === s.numero);
  const centros = propias.map((m) => turf.centroid(m.geometria).geometry.coordinates);
  // La longitud se escala por el coseno de la latitud para medir en distancias reales.
  const k = Math.cos((centros[0][1] * Math.PI) / 180);
  const planos = centros.map(([x, y]) => [x * k, y]);
  const [ex, ey] = ejeLargo(planos);
  const orden = propias.map((m, i) => ({ m, t: planos[i][0] * ex + planos[i][1] * ey })).sort((a, b) => a.t - b.t);
  const grupos = Array.from({ length: ZONAS_POR_SECTOR }, () => []);
  orden.forEach((o, i) => grupos[Math.min(ZONAS_POR_SECTOR - 1, Math.floor((i * ZONAS_POR_SECTOR) / orden.length))].push(o.m));

  grupos.forEach((grupo, j) => {
    const numero = (s.numero - 1) * ZONAS_POR_SECTOR + j + 1;
    for (const m of grupo) m.zona_numero = AJUSTES[m.codigo] ?? numero;
  });
}

for (const s of sectores) {
  for (let j = 0; j < ZONAS_POR_SECTOR; j++) {
    const numero = (s.numero - 1) * ZONAS_POR_SECTOR + j + 1;
    const grupo = manzanas.filter((m) => m.zona_numero === numero);
    // Las manzanas comparten los ejes de las calles, así que la unión deja un borde que sigue las calles.
    const union = grupo.length > 1 ? turf.union(turf.featureCollection(grupo.map((m) => turf.feature(m.geometria)))) : turf.feature(grupo[0].geometria);
    zonas.push({ numero, sector_numero: s.numero, nombre: `Zona ${numero}`, color_borde: s.color_borde, geometria: union.geometry });
    grupo.sort((a, b) => a.codigo.localeCompare(b.codigo)).forEach((m, i) => {
      resultado.push({ ...m, codigo: `Z${String(numero).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}` });
    });
  }
}

fs.writeFileSync("supabase/seed/zonas.json", JSON.stringify(zonas));
fs.writeFileSync("supabase/seed/manzanas.json", JSON.stringify(resultado));
console.log(zonas.map((z) => `Zona ${z.numero} (sector ${z.sector_numero}): ${resultado.filter((m) => m.zona_numero === z.numero).length}`).join("\n"));

fs.writeFileSync("public/revision.html", `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Revisión de zonas</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0}.et{background:#fff;border:1px solid #333;border-radius:4px;padding:1px 4px;font:600 12px system-ui}</style><div id="m"></div><script>
const S=${JSON.stringify(sectores)},Z=${JSON.stringify(zonas)},M=${JSON.stringify(resultado)};
const m=L.map('m');L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(m);
const T=['#fca5a5','#93c5fd','#fde68a'];
M.forEach(a=>L.geoJSON(a.geometria,{style:{color:'#555',weight:1,fillColor:T[(a.zona_numero-1)%3],fillOpacity:.55}}).bindTooltip(a.codigo).addTo(m));
Z.forEach(z=>{const g=L.geoJSON(z.geometria,{style:{color:z.color_borde,weight:2,dashArray:'6 4',fill:false}}).addTo(m);L.marker(g.getBounds().getCenter(),{icon:L.divIcon({className:'et',html:'Zona '+z.numero,iconSize:null})}).addTo(m)});
const g=L.featureGroup(S.map(s=>L.geoJSON(s.geometria,{style:{color:s.color_borde,weight:5,fill:false}}))).addTo(m);
m.fitBounds(g.getBounds());</script>`);
