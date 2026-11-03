# Programa de evangelismo IPUC: plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicación web publicada en Vercel, con datos en Supabase, para registrar reportes de evangelismo, pintar en el mapa las manzanas alcanzadas y generar estadísticas e informes.

**Architecture:** Next.js (App Router) habla con Supabase desde el navegador con la sesión del usuario. La seguridad vive en la base de datos con Row Level Security. Solo la gestión de usuarios y la tarea que evita la pausa usan la clave de servicio, en rutas de servidor. Zonas y manzanas salen de un script que se ejecuta una vez sobre datos de OpenStreetMap.

**Tech Stack:** Next.js con TypeScript, Supabase (Postgres, Auth, RLS), Leaflet, Recharts, jsPDF con jspdf-autotable, ExcelJS, PapaParse, Turf (solo en el script), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-evangelismo-ipuc-design.md`

## Global Constraints

- Todo texto visible para el usuario va en español.
- La clave de servicio de Supabase nunca llega al navegador ni al repositorio. No se usa el prefijo `NEXT_PUBLIC_` para ella.
- Contraseñas y tokens no se escriben en el chat ni en archivos versionados.
- El relleno de una manzana solo indica estado: verde `#22c55e` alcanzada, rojo `#ef4444` sin predicar. El color de zona solo se usa en el borde.
- Colores de zona provisionales: Zona 1 `#eab308`, Zona 2 `#7c3aed`, Zona 3 `#b91c1c`, Zona 4 `#15803d`.
- Las pantallas deben funcionar a 360 px de ancho.

## Estructura de archivos

```
data/zonas-pixeles.json        vértices de zonas en píxeles de la imagen y transformación a coordenadas
scripts/generar-manzanas.mjs   vías OSM -> supabase/seed/*.json y revision.html
scripts/cargar-semilla.mjs     carga zonas y manzanas a Supabase
scripts/crear-admin.mjs        crea el primer administrador
supabase/migrations/           esquema, RLS y funciones
tests/seguridad/rls.test.ts    pruebas de RLS contra el proyecto Supabase
src/lib/tipos.ts               tipos compartidos
src/lib/mapa/avance.ts         estado y avance de manzanas
src/lib/reporte/validar.ts     reglas del formulario
src/lib/importar/leer.ts       traducción de filas de Google Forms
src/lib/supabase/{cliente,servidor,servicio}.ts
src/lib/informes/{pdf,excel}.ts
src/components/MapaManzanas.tsx mapa Leaflet reutilizable
src/components/FormularioReporte.tsx
src/app/...                    pantallas y rutas de API
```

---

### Task 1: Proyecto base, zonas y generación de manzanas

**Files:**
- Create: proyecto Next.js en la raíz, `vitest.config.ts`, `.env.example`
- Create: `data/zonas-pixeles.json`, `scripts/generar-manzanas.mjs`
- Create: `supabase/seed/zonas.json`, `supabase/seed/manzanas.json`, `public/revision.html` (generados)

**Interfaces:**
- Produces: `zonas.json` con `{numero,nombre,color_borde,geometria}` y `manzanas.json` con `{codigo,zona_numero,geometria}`; `geometria` es un GeoJSON Polygon.

- [ ] **Step 1: Crear el proyecto**

La carpeta ya tiene `docs/`, así que se genera en una carpeta temporal y se mueve a la raíz.

```bash
npx create-next-app@latest app-tmp --ts --app --src-dir --eslint --no-tailwind --import-alias "@/*" --use-npm --yes
cp -r app-tmp/. . && rm -rf app-tmp
npm i @supabase/supabase-js @supabase/ssr leaflet recharts jspdf jspdf-autotable exceljs papaparse
npm i -D vitest @types/leaflet @types/papaparse @turf/turf dotenv
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

Agregar a `package.json` los scripts `"test": "vitest run"` y `"test:seguridad": "vitest run --config vitest.seguridad.config.ts"`. Agregar `.env*.local` a `.gitignore` si no está.

- [ ] **Step 2: Registrar las zonas**

`data/zonas-pixeles.json`. La transformación es la ajustada visualmente sobre la imagen del usuario: `lon = lon0 + (x - x0) / sx`, `lat = lat0 - (y - y0) / sy`.

```json
{
  "transformacion": { "lat0": 10.4645795, "lon0": -73.2661515, "x0": 240, "y0": 706, "sx": 50000, "sy": 52000 },
  "zonas": [
    { "numero": 1, "nombre": "Zona 1", "color_borde": "#eab308",
      "pixeles": [[252,637],[475,522],[498,585],[711,481],[745,581],[519,696],[375,764],[357,782],[271,696]] },
    { "numero": 2, "nombre": "Zona 2", "color_borde": "#7c3aed",
      "pixeles": [[745,581],[923,675],[865,853],[818,934],[603,822],[622,767],[519,696]] },
    { "numero": 3, "nombre": "Zona 3", "color_borde": "#b91c1c",
      "pixeles": [[519,696],[622,767],[603,822],[818,934],[742,1090],[524,970],[545,921],[365,824],[375,811],[360,785],[375,764]] },
    { "numero": 4, "nombre": "Zona 4", "color_borde": "#15803d",
      "pixeles": [[271,696],[360,785],[375,811],[365,824],[545,921],[472,1067],[230,935],[150,875],[88,790]] }
  ]
}
```

- [ ] **Step 3: Escribir el generador**

`scripts/generar-manzanas.mjs`:

```js
import fs from "node:fs";
import * as turf from "@turf/turf";

const VIAS_DESCARTADAS = new Set(["footway", "path", "cycleway", "track", "service", "construction", "steps"]);
const AREA_MIN_M2 = 400;
const AREA_MAX_M2 = 40000;
const SERVIDORES = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const CONSULTA = '[out:json][timeout:60];way["highway"](10.452,-73.278,10.472,-73.248);out tags geom;';

async function descargarVias() {
  for (const url of SERVIDORES) {
    const r = await fetch(url, { method: "POST", body: new URLSearchParams({ data: CONSULTA }) });
    if (r.ok) return (await r.json()).elements;
    console.warn(`Overpass ${url}: HTTP ${r.status}`);
  }
  throw new Error("Ningún servidor de Overpass respondió");
}

const { transformacion: t, zonas } = JSON.parse(fs.readFileSync("data/zonas-pixeles.json", "utf8"));
const aLonLat = ([x, y]) => [t.lon0 + (x - t.x0) / t.sx, t.lat0 - (y - t.y0) / t.sy];
const redondear = (n) => Math.round(n * 1e6) / 1e6;

const zonasGeo = zonas.map((z) => {
  const anillo = z.pixeles.map(aLonLat).map(([a, b]) => [redondear(a), redondear(b)]);
  return { numero: z.numero, nombre: z.nombre, color_borde: z.color_borde,
           geometria: { type: "Polygon", coordinates: [[...anillo, anillo[0]]] } };
});

const elementos = await descargarVias();
const lineas = elementos
  .filter((e) => e.type === "way" && !VIAS_DESCARTADAS.has(e.tags.highway))
  .map((e) => turf.lineString(e.geometry.map((g) => [g.lon, g.lat])));

// polygonize exige líneas cortadas en cada cruce
const cortadas = [];
for (const l of lineas) {
  let piezas = [l];
  for (const o of lineas) {
    if (o === l) continue;
    if (!turf.booleanIntersects(turf.bboxPolygon(turf.bbox(l)), turf.bboxPolygon(turf.bbox(o)))) continue;
    piezas = piezas.flatMap((p) => turf.lineSplit(p, o).features.length ? turf.lineSplit(p, o).features : [p]);
  }
  cortadas.push(...piezas);
}
const poligonos = turf.polygonize(turf.featureCollection(cortadas)).features;

const contadores = new Map();
const manzanas = [];
let descartadas = 0;
for (const p of poligonos) {
  const area = turf.area(p);
  if (area < AREA_MIN_M2 || area > AREA_MAX_M2) { descartadas++; continue; }
  const centro = turf.pointOnFeature(p);
  const zona = zonasGeo.find((z) => turf.booleanPointInPolygon(centro, turf.feature(z.geometria)));
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
```

- [ ] **Step 4: Ejecutar y comprobar la factibilidad**

Run: `node scripts/generar-manzanas.mjs`
Expected: las cuatro zonas con manzanas y un total del orden de 200 a 500.

Dibujar las manzanas sobre la imagen del usuario, invirtiendo la transformación, y ver el resultado. Comprobar que casi todo el interior de cada zona queda cubierto por manzanas de tamaño creíble. **Si faltan muchas manzanas o se fusionan, detenerse y consultar al usuario**, como exige el diseño.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: proyecto base y generación de zonas y manzanas"
```

---

### Task 2: Base de datos, seguridad y carga inicial

**Files:**
- Create: `supabase/migrations/20261103000000_esquema.sql`, `scripts/cargar-semilla.mjs`, `scripts/crear-admin.mjs`, `.env.example`
- Test: `tests/seguridad/rls.test.ts`, `vitest.seguridad.config.ts`

**Interfaces:**
- Consumes: `supabase/seed/*.json` de la Task 1.
- Produces: tablas del diseño; RPC `guardar_reporte(p_id uuid, p_reporte jsonb, p_manzanas uuid[], p_casos jsonb) returns uuid`, `estado_manzanas(p_desde date, p_hasta date)`, `estadisticas(p_desde date, p_hasta date, p_zona uuid) returns jsonb`, `importar_reportes(p_filas jsonb) returns int`.

- [ ] **Step 1: Crear el proyecto Supabase**

El usuario inicia sesión con `npx supabase login` y crea el proyecto en la región de EE. UU. más cercana (por ejemplo `us-east-1`). Luego `npx supabase init` y `npx supabase link --project-ref <ref>`. El usuario copia las claves a `.env.local`, sin pegarlas en el chat.

`.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

- [ ] **Step 2: Escribir la migración**

`supabase/migrations/20261103000000_esquema.sql`:

```sql
create table zonas (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique check (numero between 1 and 4),
  nombre text not null,
  color_borde text not null,
  geometria jsonb not null
);

create table manzanas (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid not null references zonas(id),
  codigo text not null unique,
  geometria jsonb not null,
  activa boolean not null default true
);

create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol text not null check (rol in ('coordinador','administrador')),
  zona_id uuid references zonas(id),
  activo boolean not null default true,
  check (rol = 'administrador' or zona_id is not null)
);

create table reportes (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid not null references zonas(id),
  creado_por uuid not null default auth.uid() references auth.users(id),
  responsable_nombre text not null,
  coordinador_nombre text not null,
  fecha_jornada date not null,
  direccion text,
  hogares_visitados int check (hogares_visitados >= 0),
  personas_contactadas int check (personas_contactadas >= 0),
  personas_aceptan_visita int check (personas_aceptan_visita >= 0),
  nombres_visita text,
  resultado_espiritual text,
  evangelismo_ninos boolean not null default false,
  ninos_alcanzados int check (ninos_alcanzados >= 0),
  receptividad int check (receptividad between 1 and 5),
  dificultad text check (dificultad in ('poco_tiempo','falta_acompanamiento','rechazo','clima','ninguna','otra')),
  dificultad_otra text,
  sugerencias text,
  origen text not null default 'app' check (origen in ('app','google_forms')),
  huella_importacion text unique,
  manzanas_pendientes boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (origen = 'google_forms' or (
    hogares_visitados is not null and personas_contactadas is not null and personas_aceptan_visita is not null
    and resultado_espiritual is not null and receptividad is not null and dificultad is not null
    and (not evangelismo_ninos or ninos_alcanzados is not null)
    and (dificultad <> 'otra' or dificultad_otra is not null)))
);
create index on reportes (fecha_jornada);
create index on reportes (zona_id);

create table reporte_manzanas (
  reporte_id uuid not null references reportes(id) on delete cascade,
  manzana_id uuid not null references manzanas(id),
  primary key (reporte_id, manzana_id)
);
create index on reporte_manzanas (manzana_id);

create table casos_especiales (
  id uuid primary key default gen_random_uuid(),
  reporte_id uuid not null references reportes(id) on delete cascade,
  zona_id uuid not null references zonas(id),
  tipo text not null check (tipo in ('enfermo','sordo','consejeria')),
  descripcion text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','atendido')),
  atendido_en timestamptz,
  unique (reporte_id, tipo)
);

-- Ayudantes de permisos. security definer para que no dependan de las políticas de perfiles.
create function usuario_activo() returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from perfiles where id = auth.uid() and activo) $$;
create function es_admin() returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from perfiles where id = auth.uid() and activo and rol = 'administrador') $$;
create function mi_zona() returns uuid language sql stable security definer set search_path = public as
  $$ select zona_id from perfiles where id = auth.uid() and activo $$;

alter table zonas enable row level security;
alter table manzanas enable row level security;
alter table perfiles enable row level security;
alter table reportes enable row level security;
alter table reporte_manzanas enable row level security;
alter table casos_especiales enable row level security;

create policy zonas_leer on zonas for select to authenticated using (usuario_activo());
create policy zonas_admin on zonas for all to authenticated using (es_admin()) with check (es_admin());
create policy manzanas_leer on manzanas for select to authenticated using (usuario_activo());
create policy manzanas_admin on manzanas for all to authenticated using (es_admin()) with check (es_admin());

create policy perfiles_leer on perfiles for select to authenticated using (id = auth.uid() or es_admin());
create policy perfiles_admin on perfiles for all to authenticated using (es_admin()) with check (es_admin());

create policy reportes_leer on reportes for select to authenticated using (es_admin() or zona_id = mi_zona());
create policy reportes_crear on reportes for insert to authenticated
  with check (es_admin() or (zona_id = mi_zona() and creado_por = auth.uid()));
create policy reportes_editar on reportes for update to authenticated
  using (es_admin() or (zona_id = mi_zona() and creado_por = auth.uid()))
  with check (es_admin() or (zona_id = mi_zona() and creado_por = auth.uid()));
create policy reportes_eliminar on reportes for delete to authenticated using (es_admin());

create policy rm_leer on reporte_manzanas for select to authenticated using (
  exists (select 1 from reportes r where r.id = reporte_id));
create policy rm_escribir on reporte_manzanas for all to authenticated
  using (exists (select 1 from reportes r where r.id = reporte_id and (es_admin() or r.creado_por = auth.uid())))
  with check (exists (select 1 from reportes r join manzanas m on m.id = manzana_id
    where r.id = reporte_id and m.zona_id = r.zona_id and (es_admin() or r.creado_por = auth.uid())));

create policy casos_leer on casos_especiales for select to authenticated using (es_admin() or zona_id = mi_zona());
create policy casos_crear on casos_especiales for insert to authenticated with check (es_admin() or zona_id = mi_zona());
create policy casos_editar on casos_especiales for update to authenticated
  using (es_admin() or zona_id = mi_zona()) with check (es_admin() or zona_id = mi_zona());
create policy casos_eliminar on casos_especiales for delete to authenticated using (es_admin() or zona_id = mi_zona());

-- Guarda un reporte con sus manzanas y casos en una sola transacción. Corre con los permisos del usuario.
create function guardar_reporte(p_id uuid, p_reporte jsonb, p_manzanas uuid[], p_casos jsonb)
returns uuid language plpgsql set search_path = public as $$
declare v_id uuid; v_origen text;
begin
  if p_id is null and coalesce(array_length(p_manzanas, 1), 0) = 0 then
    raise exception 'Marque al menos una manzana' using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into reportes (zona_id, responsable_nombre, coordinador_nombre, fecha_jornada, direccion,
      hogares_visitados, personas_contactadas, personas_aceptan_visita, nombres_visita, resultado_espiritual,
      evangelismo_ninos, ninos_alcanzados, receptividad, dificultad, dificultad_otra, sugerencias)
    select zona_id, responsable_nombre, coordinador_nombre, fecha_jornada, direccion,
      hogares_visitados, personas_contactadas, personas_aceptan_visita, nombres_visita, resultado_espiritual,
      evangelismo_ninos, ninos_alcanzados, receptividad, dificultad, dificultad_otra, sugerencias
    from jsonb_populate_record(null::reportes, p_reporte)
    returning id into v_id;
  else
    update reportes r set
      responsable_nombre = n.responsable_nombre, coordinador_nombre = n.coordinador_nombre,
      fecha_jornada = n.fecha_jornada, direccion = n.direccion, hogares_visitados = n.hogares_visitados,
      personas_contactadas = n.personas_contactadas, personas_aceptan_visita = n.personas_aceptan_visita,
      nombres_visita = n.nombres_visita, resultado_espiritual = n.resultado_espiritual,
      evangelismo_ninos = n.evangelismo_ninos, ninos_alcanzados = n.ninos_alcanzados,
      receptividad = n.receptividad, dificultad = n.dificultad, dificultad_otra = n.dificultad_otra,
      sugerencias = n.sugerencias, actualizado_en = now(),
      manzanas_pendientes = coalesce(array_length(p_manzanas, 1), 0) = 0 and r.origen = 'google_forms'
    from jsonb_populate_record(null::reportes, p_reporte) n
    where r.id = p_id
    returning r.id, r.origen into v_id, v_origen;
    if v_id is null then raise exception 'No tiene permiso para editar este reporte' using errcode = '42501'; end if;
    if v_origen = 'app' and coalesce(array_length(p_manzanas, 1), 0) = 0 then
      raise exception 'Marque al menos una manzana' using errcode = 'P0001';
    end if;
    delete from reporte_manzanas where reporte_id = v_id;
  end if;

  insert into reporte_manzanas (reporte_id, manzana_id) select v_id, unnest(p_manzanas);

  delete from casos_especiales c where c.reporte_id = v_id
    and c.tipo not in (select jsonb_array_elements(p_casos) ->> 'tipo');
  insert into casos_especiales (reporte_id, zona_id, tipo, descripcion)
    select v_id, r.zona_id, e ->> 'tipo', e ->> 'descripcion'
    from jsonb_array_elements(p_casos) e, reportes r where r.id = v_id
    on conflict (reporte_id, tipo) do update set descripcion = excluded.descripcion;
  return v_id;
end $$;

-- Lo que todos pueden ver: nada de texto libre ni datos personales.
create function estado_manzanas(p_desde date, p_hasta date)
returns table (manzana_id uuid, ultima_fecha date, jornadas bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not usuario_activo() then raise exception 'Sin acceso' using errcode = '42501'; end if;
  return query
    select rm.manzana_id, max(r.fecha_jornada), count(*)
    from reporte_manzanas rm join reportes r on r.id = rm.reporte_id
    where r.fecha_jornada between p_desde and p_hasta
    group by rm.manzana_id;
end $$;

create function estadisticas(p_desde date, p_hasta date, p_zona uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not usuario_activo() then raise exception 'Sin acceso' using errcode = '42501'; end if;
  with f as (
    select * from reportes
    where fecha_jornada between p_desde and p_hasta and (p_zona is null or zona_id = p_zona)
  ), alcanzadas as (
    select distinct rm.manzana_id from reporte_manzanas rm join f on f.id = rm.reporte_id
  )
  select jsonb_build_object(
    'totales', (select jsonb_build_object(
        'jornadas', count(*),
        'hogares', coalesce(sum(hogares_visitados), 0),
        'personas', coalesce(sum(personas_contactadas), 0),
        'visitas', coalesce(sum(personas_aceptan_visita), 0),
        'ninos', coalesce(sum(ninos_alcanzados), 0),
        'receptividad', round(avg(receptividad), 2),
        'pendientes_marcar', count(*) filter (where manzanas_pendientes)) from f),
    'por_zona', (select coalesce(jsonb_agg(x order by x.numero), '[]') from (
        select z.numero, z.nombre,
          (select count(*) from manzanas m where m.zona_id = z.id and m.activa) as manzanas_total,
          (select count(*) from manzanas m join alcanzadas a on a.manzana_id = m.id where m.zona_id = z.id and m.activa) as manzanas_alcanzadas,
          (select count(*) from f where f.zona_id = z.id) as jornadas,
          (select coalesce(sum(personas_contactadas), 0) from f where f.zona_id = z.id) as personas
        from zonas z where p_zona is null or z.id = p_zona) x),
    'por_mes', (select coalesce(jsonb_agg(x order by x.mes), '[]') from (
        select to_char(fecha_jornada, 'YYYY-MM') as mes, count(*) as jornadas,
          coalesce(sum(personas_contactadas), 0) as personas, coalesce(sum(hogares_visitados), 0) as hogares
        from f group by 1) x),
    'dificultades', (select coalesce(jsonb_agg(x order by x.cantidad desc), '[]') from (
        select dificultad, count(*) as cantidad from f where dificultad is not null group by 1) x),
    'casos', (select coalesce(jsonb_agg(x), '[]') from (
        select c.tipo, count(*) as cantidad, count(*) filter (where c.estado = 'pendiente') as pendientes
        from casos_especiales c join f on f.id = c.reporte_id group by 1) x)
  ) into v;
  return v;
end $$;

-- Importa filas ya validadas. Devuelve cuántas son nuevas.
create function importar_reportes(p_filas jsonb) returns int
language plpgsql set search_path = public as $$
declare e jsonb; v_id uuid; v_n int := 0;
begin
  if not es_admin() then raise exception 'Sin acceso' using errcode = '42501'; end if;
  for e in select * from jsonb_array_elements(p_filas) loop
    insert into reportes (zona_id, responsable_nombre, coordinador_nombre, fecha_jornada, direccion,
      hogares_visitados, personas_contactadas, personas_aceptan_visita, nombres_visita, resultado_espiritual,
      evangelismo_ninos, ninos_alcanzados, receptividad, dificultad, dificultad_otra, sugerencias,
      origen, huella_importacion, manzanas_pendientes)
    select zona_id, responsable_nombre, coordinador_nombre, fecha_jornada, direccion,
      hogares_visitados, personas_contactadas, personas_aceptan_visita, nombres_visita, resultado_espiritual,
      evangelismo_ninos, ninos_alcanzados, receptividad, dificultad, dificultad_otra, sugerencias,
      'google_forms', huella_importacion, true
    from jsonb_populate_record(null::reportes, e -> 'reporte')
    on conflict (huella_importacion) do nothing
    returning id into v_id;
    if v_id is not null then
      v_n := v_n + 1;
      insert into casos_especiales (reporte_id, zona_id, tipo, descripcion)
        select v_id, (e -> 'reporte' ->> 'zona_id')::uuid, c ->> 'tipo', c ->> 'descripcion'
        from jsonb_array_elements(e -> 'casos') c;
      v_id := null;
    end if;
  end loop;
  return v_n;
end $$;

revoke execute on function guardar_reporte(uuid, jsonb, uuid[], jsonb), estado_manzanas(date, date),
  estadisticas(date, date, uuid), importar_reportes(jsonb), usuario_activo(), es_admin(), mi_zona() from public, anon;
grant execute on function guardar_reporte(uuid, jsonb, uuid[], jsonb), estado_manzanas(date, date),
  estadisticas(date, date, uuid), importar_reportes(jsonb), usuario_activo(), es_admin(), mi_zona() to authenticated;
```

- [ ] **Step 3: Aplicar la migración y cargar la semilla**

`scripts/cargar-semilla.mjs`:

```js
import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ path: ".env.local" });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const leer = (n) => JSON.parse(fs.readFileSync(`supabase/seed/${n}.json`, "utf8"));
const comprobar = ({ error }) => { if (error) throw error; };

comprobar(await db.from("zonas").upsert(leer("zonas"), { onConflict: "numero" }));
const { data: zonas, error } = await db.from("zonas").select("id,numero");
if (error) throw error;
const idZona = new Map(zonas.map((z) => [z.numero, z.id]));
const filas = leer("manzanas").map((m) => ({ codigo: m.codigo, geometria: m.geometria, zona_id: idZona.get(m.zona_numero) }));
comprobar(await db.from("manzanas").upsert(filas, { onConflict: "codigo" }));
console.log(`Zonas: ${zonas.length}, manzanas: ${filas.length}`);
```

Run: `npx supabase db push` y `node scripts/cargar-semilla.mjs`
Expected: `Zonas: 4, manzanas: N`, con N igual al total de la Task 1.

- [ ] **Step 4: Escribir las pruebas de seguridad**

`vitest.seguridad.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/seguridad/**/*.test.ts"], testTimeout: 30000, hookTimeout: 60000 } });
```

`tests/seguridad/rls.test.ts`. Crea usuarios temporales con contraseñas aleatorias y los borra al terminar.

```ts
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
dotenv.config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const srv = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const creados: string[] = [];

async function usuario(rol: string, zona_id: string | null) {
  const email = `prueba-${randomUUID()}@example.com`, password = randomUUID();
  const { data, error } = await srv.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  creados.push(data.user.id);
  const r = await srv.from("perfiles").insert({ id: data.user.id, nombre_completo: "Prueba", rol, zona_id });
  if (r.error) throw r.error;
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  return { c, id: data.user.id };
}

const base = (zona_id: string) => ({
  zona_id, responsable_nombre: "R", coordinador_nombre: "C", fecha_jornada: "2099-01-15",
  hogares_visitados: 3, personas_contactadas: 5, personas_aceptan_visita: 1, nombres_visita: "NOMBRE-SECRETO",
  resultado_espiritual: "TEXTO-SECRETO", evangelismo_ninos: false, receptividad: 4, dificultad: "ninguna",
});

let z1: string, z2: string, m1: string, m2: string;
let c1: SupabaseClient, c2: SupabaseClient, admin: SupabaseClient, reporteZ1: string;

beforeAll(async () => {
  const { data: zonas } = await srv.from("zonas").select("id,numero").order("numero");
  z1 = zonas![0].id; z2 = zonas![1].id;
  const pick = async (z: string) => (await srv.from("manzanas").select("id").eq("zona_id", z).limit(1).single()).data!.id;
  m1 = await pick(z1); m2 = await pick(z2);
  c1 = (await usuario("coordinador", z1)).c;
  c2 = (await usuario("coordinador", z2)).c;
  admin = (await usuario("administrador", null)).c;
  const r = await c1.rpc("guardar_reporte", { p_id: null, p_reporte: base(z1), p_manzanas: [m1],
    p_casos: [{ tipo: "enfermo", descripcion: "CASO-SECRETO" }] });
  if (r.error) throw r.error;
  reporteZ1 = r.data;
});

afterAll(async () => {
  await srv.from("reportes").delete().gte("fecha_jornada", "2099-01-01");
  await Promise.all(creados.map((id) => srv.auth.admin.deleteUser(id)));
});

describe("aislamiento por zona", () => {
  it("el coordinador de otra zona no ve el reporte", async () => {
    expect((await c2.from("reportes").select("id").eq("id", reporteZ1)).data).toEqual([]);
  });
  it("el coordinador de otra zona no ve el caso especial", async () => {
    expect((await c2.from("casos_especiales").select("id").eq("reporte_id", reporteZ1)).data).toEqual([]);
  });
  it("el coordinador de la zona y el administrador sí lo ven", async () => {
    expect((await c1.from("reportes").select("id").eq("id", reporteZ1)).data).toHaveLength(1);
    expect((await admin.from("casos_especiales").select("id").eq("reporte_id", reporteZ1)).data).toHaveLength(1);
  });
  it("un coordinador no puede crear reportes en otra zona", async () => {
    const r = await c2.rpc("guardar_reporte", { p_id: null, p_reporte: base(z1), p_manzanas: [m1], p_casos: [] });
    expect(r.error).not.toBeNull();
  });
  it("no se pueden marcar manzanas de otra zona", async () => {
    const r = await c1.rpc("guardar_reporte", { p_id: null, p_reporte: base(z1), p_manzanas: [m2], p_casos: [] });
    expect(r.error).not.toBeNull();
  });
  it("un coordinador no puede editar reportes de otra zona", async () => {
    const r = await c2.rpc("guardar_reporte", { p_id: reporteZ1, p_reporte: base(z1), p_manzanas: [m1], p_casos: [] });
    expect(r.error).not.toBeNull();
  });
  it("un coordinador no puede eliminar reportes", async () => {
    await c1.from("reportes").delete().eq("id", reporteZ1);
    expect((await srv.from("reportes").select("id").eq("id", reporteZ1)).data).toHaveLength(1);
  });
});

describe("escalada de privilegios", () => {
  it("un coordinador no puede volverse administrador", async () => {
    const yo = (await c1.auth.getUser()).data.user!.id;
    await c1.from("perfiles").update({ rol: "administrador" }).eq("id", yo);
    expect((await srv.from("perfiles").select("rol").eq("id", yo).single()).data!.rol).toBe("coordinador");
  });
  it("un coordinador no puede importar", async () => {
    expect((await c1.rpc("importar_reportes", { p_filas: [] })).error).not.toBeNull();
  });
});

describe("funciones agregadas", () => {
  it("estadisticas no expone texto libre a otra zona", async () => {
    const r = await c2.rpc("estadisticas", { p_desde: "2099-01-01", p_hasta: "2099-12-31" });
    expect(r.error).toBeNull();
    expect(r.data.totales.jornadas).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(r.data)).not.toMatch(/SECRETO/);
  });
  it("estado_manzanas muestra la manzana sin datos personales", async () => {
    const r = await c2.rpc("estado_manzanas", { p_desde: "2099-01-01", p_hasta: "2099-12-31" });
    expect(r.data!.map((x: { manzana_id: string }) => x.manzana_id)).toContain(m1);
    expect(JSON.stringify(r.data)).not.toMatch(/SECRETO/);
  });
  it("un visitante sin sesión no puede leer nada", async () => {
    const a = createClient(URL, ANON, { auth: { persistSession: false } });
    expect((await a.rpc("estadisticas", { p_desde: "2099-01-01", p_hasta: "2099-12-31" })).error).not.toBeNull();
    expect((await a.from("reportes").select("id")).data ?? []).toEqual([]);
    expect((await a.from("manzanas").select("id")).data ?? []).toEqual([]);
  });
  it("un usuario desactivado pierde el acceso", async () => {
    const { c, id } = await usuario("coordinador", z1);
    await srv.from("perfiles").update({ activo: false }).eq("id", id);
    expect((await c.from("reportes").select("id").eq("id", reporteZ1)).data).toEqual([]);
    expect((await c.rpc("estado_manzanas", { p_desde: "2099-01-01", p_hasta: "2099-12-31" })).error).not.toBeNull();
  });
});
```

- [ ] **Step 5: Ejecutar las pruebas**

Run: `npm run test:seguridad`
Expected: PASS en todas. Una falla aquí es un defecto de seguridad y se corrige en la migración con una migración nueva.

- [ ] **Step 6: Script del primer administrador y commit**

`scripts/crear-admin.mjs`. Lo ejecuta el usuario en su terminal, para que la contraseña no pase por el chat. Pide la contraseña sin mostrarla en pantalla.

```js
import dotenv from "dotenv";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ path: ".env.local" });

const [email, ...nombre] = process.argv.slice(2);
if (!email || !nombre.length) { console.error("Uso: node scripts/crear-admin.mjs correo Nombre Completo"); process.exit(1); }

function pedirOculto(texto) {
  return new Promise((resolver) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(texto)) process.stdout.write(s); };
    rl.question(texto, (v) => { rl.close(); process.stdout.write("\n"); resolver(v); });
  });
}
const password = await pedirOculto("Contraseña (mínimo 8 caracteres): ");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
const r = await db.from("perfiles").insert({ id: data.user.id, nombre_completo: nombre.join(" "), rol: "administrador" });
if (r.error) throw r.error;
console.log("Administrador creado:", email);
```

```bash
git add -A && git commit -m "feat: esquema, seguridad por filas y carga inicial"
```

---

### Task 3: Ingreso y estructura de la aplicación

**Files:**
- Create: `src/lib/tipos.ts`, `src/lib/supabase/cliente.ts`, `src/lib/supabase/servidor.ts`, `src/lib/supabase/servicio.ts`, `src/middleware.ts`
- Create: `src/app/ingreso/page.tsx`, `src/app/(app)/layout.tsx`, `src/components/Navegacion.tsx`, `src/app/globals.css`
- Modify: `src/app/page.tsx` (redirige a `/mapa`), `src/app/layout.tsx` (`lang="es"`, título)

**Interfaces:**
- Produces: `crearClienteNavegador()`, `crearClienteServidor(): Promise<SupabaseClient>`, `crearClienteServicio()`, `obtenerPerfil(): Promise<Perfil | null>`, y los tipos `Perfil`, `Zona`, `Manzana`, `EstadoManzana`, `TipoCaso`, `Dificultad`.

- [ ] **Step 1: Tipos y clientes**

`src/lib/tipos.ts`:

```ts
export type Rol = "coordinador" | "administrador";
export type TipoCaso = "enfermo" | "sordo" | "consejeria";
export type Dificultad = "poco_tiempo" | "falta_acompanamiento" | "rechazo" | "clima" | "ninguna" | "otra";
export type Poligono = { type: "Polygon"; coordinates: number[][][] };
export type Perfil = { id: string; nombre_completo: string; rol: Rol; zona_id: string | null; activo: boolean };
export type Zona = { id: string; numero: number; nombre: string; color_borde: string; geometria: Poligono };
export type Manzana = { id: string; zona_id: string; codigo: string; geometria: Poligono; activa: boolean };
export type EstadoManzana = { manzana_id: string; ultima_fecha: string; jornadas: number };
export const ETIQUETA_DIFICULTAD: Record<Dificultad, string> = {
  poco_tiempo: "Poco tiempo", falta_acompanamiento: "Falta de acompañamiento", rechazo: "Rechazo de las personas",
  clima: "Condiciones climáticas", ninguna: "Ninguna", otra: "Otra",
};
export const ETIQUETA_CASO: Record<TipoCaso, string> = {
  enfermo: "Persona enferma", sordo: "Persona sorda", consejeria: "Consejería o visitación",
};
```

`src/lib/supabase/cliente.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
export const crearClienteNavegador = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
```

`src/lib/supabase/servidor.ts`:

```ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Perfil } from "@/lib/tipos";

export async function crearClienteServidor() {
  const almacen = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try { lista.forEach(({ name, value, options }) => almacen.set(name, value, options)); } catch { /* en un Server Component las cookies son de solo lectura */ }
      },
    },
  });
}

export async function obtenerPerfil(): Promise<Perfil | null> {
  const db = await crearClienteServidor();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from("perfiles").select("*").eq("id", user.id).single();
  return data?.activo ? (data as Perfil) : null;
}
```

`src/lib/supabase/servicio.ts`:

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
export const crearClienteServicio = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
```

Instalar con `npm i server-only`.

- [ ] **Step 2: Sesión y rutas protegidas**

`src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await db.auth.getUser();
  const enIngreso = request.nextUrl.pathname.startsWith("/ingreso");
  if (!user && !enIngreso) return NextResponse.redirect(new URL("/ingreso", request.url));
  if (user && enIngreso) return NextResponse.redirect(new URL("/mapa", request.url));
  return respuesta;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/mantener-activo|revision.html).*)"] };
```

- [ ] **Step 3: Pantallas**

`src/app/ingreso/page.tsx`: componente cliente con correo y contraseña que llama a `signInWithPassword`, muestra "Correo o contraseña incorrectos" al fallar y al entrar hace `window.location.assign("/mapa")`.

`src/app/(app)/layout.tsx`: Server Component que llama a `obtenerPerfil()`. Sin perfil redirige a `/ingreso`. Renderiza `<Navegacion perfil={perfil} />` y `children`.

`src/components/Navegacion.tsx`: enlaces Mapa, Nuevo reporte, Reportes, Casos, Estadísticas y Cuenta. Informes y Administración solo si `perfil.rol === "administrador"`. Botón Salir que llama a `signOut` y va a `/ingreso`. Barra inferior fija en celular y superior en escritorio.

`src/app/globals.css`: variables de color, tipografía del sistema, clases `.tarjeta`, `.boton`, `.campo`, `.error`, `.rejilla-kpi`, con objetivos táctiles de al menos 44 px.

- [ ] **Step 4: Verificar y commit**

Run: `npm run build`
Expected: compila sin errores. Con `npm run dev`, abrir `/mapa` sin sesión redirige a `/ingreso`.

```bash
git add -A && git commit -m "feat: ingreso, sesión y navegación por rol"
```

---

### Task 4: Mapa reutilizable y pantalla de avance

**Files:**
- Create: `src/lib/mapa/avance.ts`, `src/lib/mapa/periodo.ts`, `src/components/MapaManzanas.tsx`, `src/components/SelectorPeriodo.tsx`, `src/app/(app)/mapa/page.tsx`
- Test: `src/lib/mapa/avance.test.ts`

**Interfaces:**
- Consumes: `Manzana`, `Zona`, `EstadoManzana`.
- Produces: `calcularAvance(manzanas, estados, zonaId?) => { total, alcanzadas, porcentaje }`, `colorManzana(alcanzada: boolean) => string`, `periodoDeAnio(anio: number) => { desde: string; hasta: string }`, y `<MapaManzanas zonas manzanas alcanzadas seleccion? alTocar? />`.

- [ ] **Step 1: Escribir la prueba que falla**

`src/lib/mapa/avance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calcularAvance, colorManzana, COLOR_ALCANZADA, COLOR_SIN_PREDICAR } from "./avance";
import { periodoDeAnio } from "./periodo";
import type { Manzana } from "@/lib/tipos";

const g = { type: "Polygon" as const, coordinates: [] };
const m = (id: string, zona_id: string, activa = true): Manzana => ({ id, zona_id, codigo: id, geometria: g, activa });
const lista = [m("a", "z1"), m("b", "z1"), m("c", "z2"), m("x", "z1", false)];
const estados = [{ manzana_id: "a", ultima_fecha: "2026-01-01", jornadas: 2 }, { manzana_id: "x", ultima_fecha: "2026-01-01", jornadas: 1 }];

describe("calcularAvance", () => {
  it("cuenta solo manzanas activas", () => {
    expect(calcularAvance(lista, estados)).toEqual({ total: 3, alcanzadas: 1, porcentaje: 33 });
  });
  it("filtra por zona", () => {
    expect(calcularAvance(lista, estados, "z1")).toEqual({ total: 2, alcanzadas: 1, porcentaje: 50 });
  });
  it("no divide entre cero", () => {
    expect(calcularAvance([], [])).toEqual({ total: 0, alcanzadas: 0, porcentaje: 0 });
  });
});

describe("colorManzana", () => {
  it("verde si fue alcanzada y rojo si no", () => {
    expect(colorManzana(true)).toBe(COLOR_ALCANZADA);
    expect(colorManzana(false)).toBe(COLOR_SIN_PREDICAR);
  });
});

describe("periodoDeAnio", () => {
  it("cubre el año completo", () => {
    expect(periodoDeAnio(2026)).toEqual({ desde: "2026-01-01", hasta: "2026-12-31" });
  });
});
```

Run: `npm test -- avance`
Expected: FAIL, módulo no encontrado.

- [ ] **Step 2: Implementar**

`src/lib/mapa/avance.ts`:

```ts
import type { EstadoManzana, Manzana } from "@/lib/tipos";

export const COLOR_ALCANZADA = "#22c55e";
export const COLOR_SIN_PREDICAR = "#ef4444";
export const colorManzana = (alcanzada: boolean) => (alcanzada ? COLOR_ALCANZADA : COLOR_SIN_PREDICAR);

export function calcularAvance(manzanas: Manzana[], estados: EstadoManzana[], zonaId?: string) {
  const conReporte = new Set(estados.map((e) => e.manzana_id));
  const activas = manzanas.filter((m) => m.activa && (!zonaId || m.zona_id === zonaId));
  const alcanzadas = activas.filter((m) => conReporte.has(m.id)).length;
  return { total: activas.length, alcanzadas, porcentaje: activas.length ? Math.round((alcanzadas / activas.length) * 100) : 0 };
}
```

`src/lib/mapa/periodo.ts`:

```ts
export const periodoDeAnio = (anio: number) => ({ desde: `${anio}-01-01`, hasta: `${anio}-12-31` });
```

- [ ] **Step 3: Verificar**

Run: `npm test -- avance`
Expected: PASS.

- [ ] **Step 4: Componente de mapa**

`src/components/MapaManzanas.tsx`:

```tsx
"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { colorManzana } from "@/lib/mapa/avance";
import type { EstadoManzana, Manzana, Zona } from "@/lib/tipos";

type Props = {
  zonas: Zona[];
  manzanas: Manzana[];
  estados: EstadoManzana[];
  seleccion?: Set<string>;
  alTocar?: (m: Manzana) => void;
};

export default function MapaManzanas({ zonas, manzanas, estados, seleccion, alTocar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const encuadrado = useRef(false);

  useEffect(() => {
    if (mapa.current || !contenedor.current) return;
    mapa.current = L.map(contenedor.current);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap",
    }).addTo(mapa.current);
    capa.current = L.layerGroup().addTo(mapa.current);
    return () => { mapa.current?.remove(); mapa.current = null; };
  }, []);

  useEffect(() => {
    if (!mapa.current || !capa.current) return;
    capa.current.clearLayers();
    const porId = new Map(estados.map((e) => [e.manzana_id, e]));
    for (const m of manzanas.filter((x) => x.activa)) {
      const estado = porId.get(m.id);
      const elegida = seleccion?.has(m.id) ?? false;
      const pol = L.geoJSON(m.geometria, { style: {
        color: elegida ? "#1d4ed8" : "#475569", weight: elegida ? 3 : 1,
        fillColor: colorManzana(elegida || !!estado), fillOpacity: 0.55,
      } });
      if (alTocar) pol.on("click", () => alTocar(m));
      else pol.bindPopup(`<b>${m.codigo}</b><br>${estado ? `Última jornada: ${estado.ultima_fecha}<br>Jornadas: ${estado.jornadas}` : "Sin predicar"}`);
      capa.current.addLayer(pol);
    }
    const bordes = L.featureGroup(zonas.map((z) => L.geoJSON(z.geometria, {
      interactive: false, style: { color: z.color_borde, weight: 5, fill: false },
    })));
    capa.current.addLayer(bordes);
    if (!encuadrado.current && zonas.length) { mapa.current.fitBounds(bordes.getBounds()); encuadrado.current = true; }
  }, [zonas, manzanas, estados, seleccion, alTocar]);

  return <div ref={contenedor} className="mapa" role="application" aria-label="Mapa de manzanas" />;
}
```

Leaflet accede a `window` al importarse, así que las páginas lo cargan con `next/dynamic` y `ssr: false`. En `globals.css`: `.mapa { height: 60vh; min-height: 360px; border-radius: 8px; z-index: 0; }`.

- [ ] **Step 5: Pantalla Mapa**

`src/components/SelectorPeriodo.tsx`: selector de año (año actual y anteriores hasta 2026) y opción "Rango" con dos campos de fecha. Prop `alCambiar({ desde, hasta })`.

`src/app/(app)/mapa/page.tsx`: componente cliente. Por defecto usa `periodoDeAnio(new Date().getFullYear())`. Carga `zonas` y `manzanas` una vez, y `rpc("estado_manzanas", { p_desde, p_hasta })` al cambiar de período. Muestra una tarjeta por zona y una de total con `calcularAvance`, una leyenda (verde "Alcanzada", rojo "Sin predicar", línea "Borde de zona") y el mapa. Si falla la carga muestra "No se pudo cargar el mapa" y un botón Reintentar.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: mapa de manzanas con avance por zona"
```

---

### Task 5: Reportes (crear, listar, ver, editar) y casos especiales

**Files:**
- Create: `src/lib/reporte/validar.ts`, `src/components/FormularioReporte.tsx`
- Create: `src/app/(app)/nuevo-reporte/page.tsx`, `src/app/(app)/reportes/page.tsx`, `src/app/(app)/reportes/[id]/page.tsx`, `src/app/(app)/casos/page.tsx`
- Test: `src/lib/reporte/validar.test.ts`

**Interfaces:**
- Consumes: `MapaManzanas`, RPC `guardar_reporte`.
- Produces: `validarReporte(d: DatosReporte): Errores`, `construirCasos(d: DatosReporte): { tipo: TipoCaso; descripcion: string }[]`, `reporteVacio()`, tipo `DatosReporte`.

- [ ] **Step 1: Escribir la prueba que falla**

`src/lib/reporte/validar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { construirCasos, reporteVacio, validarReporte, type DatosReporte } from "./validar";

const valido = (c: Partial<DatosReporte> = {}): DatosReporte => ({
  ...reporteVacio(), zona_id: "z", responsable_nombre: "Ana", coordinador_nombre: "Luis", fecha_jornada: "2026-03-01",
  hogares_visitados: "12", personas_contactadas: "20", personas_aceptan_visita: "3", resultado_espiritual: "Oraron",
  receptividad: "4", dificultad: "ninguna", manzanas: ["m1"], ...c,
});

describe("validarReporte", () => {
  it("acepta un reporte completo, con más de 5 hogares", () => {
    expect(validarReporte(valido())).toEqual({});
  });
  it("exige al menos una manzana", () => {
    expect(validarReporte(valido({ manzanas: [] })).manzanas).toBeTruthy();
  });
  it("no exige manzanas en un reporte importado", () => {
    expect(validarReporte(valido({ manzanas: [], origen: "google_forms" })).manzanas).toBeUndefined();
  });
  it("rechaza números negativos o decimales", () => {
    expect(validarReporte(valido({ hogares_visitados: "-1" })).hogares_visitados).toBeTruthy();
    expect(validarReporte(valido({ personas_contactadas: "1.5" })).personas_contactadas).toBeTruthy();
  });
  it("exige descripción solo si hay un caso especial", () => {
    expect(validarReporte(valido()).descripcion_caso).toBeUndefined();
    expect(validarReporte(valido({ caso_enfermo: true })).descripcion_caso).toBeTruthy();
    expect(validarReporte(valido({ caso_enfermo: true, descripcion_caso: "Don Pedro" })).descripcion_caso).toBeUndefined();
  });
  it("exige la cantidad de niños solo si hubo evangelismo a niños", () => {
    expect(validarReporte(valido()).ninos_alcanzados).toBeUndefined();
    expect(validarReporte(valido({ evangelismo_ninos: true })).ninos_alcanzados).toBeTruthy();
    expect(validarReporte(valido({ evangelismo_ninos: true, ninos_alcanzados: "4" })).ninos_alcanzados).toBeUndefined();
  });
  it("exige detalle si la dificultad es Otra", () => {
    expect(validarReporte(valido({ dificultad: "otra" })).dificultad_otra).toBeTruthy();
  });
  it("no acepta fechas futuras", () => {
    expect(validarReporte(valido({ fecha_jornada: "2999-01-01" })).fecha_jornada).toBeTruthy();
  });
});

describe("construirCasos", () => {
  it("crea una fila por cada Sí, con la misma descripción", () => {
    const c = construirCasos(valido({ caso_enfermo: true, caso_sordo: true, descripcion_caso: "D" }));
    expect(c).toEqual([{ tipo: "enfermo", descripcion: "D" }, { tipo: "sordo", descripcion: "D" }]);
  });
  it("devuelve vacío si no hay casos", () => {
    expect(construirCasos(valido())).toEqual([]);
  });
});
```

Run: `npm test -- validar`
Expected: FAIL, módulo no encontrado.

- [ ] **Step 2: Implementar**

`src/lib/reporte/validar.ts`:

```ts
import type { Dificultad, TipoCaso } from "@/lib/tipos";

export type DatosReporte = {
  zona_id: string; responsable_nombre: string; coordinador_nombre: string; fecha_jornada: string;
  direccion: string; hogares_visitados: string; personas_contactadas: string; personas_aceptan_visita: string;
  nombres_visita: string; resultado_espiritual: string; caso_enfermo: boolean; caso_sordo: boolean;
  caso_consejeria: boolean; descripcion_caso: string; evangelismo_ninos: boolean; ninos_alcanzados: string;
  receptividad: string; dificultad: Dificultad | ""; dificultad_otra: string; sugerencias: string;
  manzanas: string[]; origen: "app" | "google_forms";
};
export type Errores = Partial<Record<keyof DatosReporte, string>>;

export const reporteVacio = (): DatosReporte => ({
  zona_id: "", responsable_nombre: "", coordinador_nombre: "", fecha_jornada: "", direccion: "",
  hogares_visitados: "", personas_contactadas: "", personas_aceptan_visita: "", nombres_visita: "",
  resultado_espiritual: "", caso_enfermo: false, caso_sordo: false, caso_consejeria: false, descripcion_caso: "",
  evangelismo_ninos: false, ninos_alcanzados: "", receptividad: "", dificultad: "", dificultad_otra: "",
  sugerencias: "", manzanas: [], origen: "app",
});

const esEntero = (v: string) => /^\d+$/.test(v.trim());

export function validarReporte(d: DatosReporte): Errores {
  const e: Errores = {};
  const requerir = (c: keyof DatosReporte, m: string) => { if (!String(d[c]).trim()) e[c] = m; };
  const numero = (c: keyof DatosReporte) => { if (!esEntero(String(d[c]))) e[c] = "Escriba un número entero, sin decimales"; };

  requerir("zona_id", "Elija la zona");
  requerir("responsable_nombre", "Escriba el nombre del responsable");
  requerir("coordinador_nombre", "Escriba el nombre del coordinador");
  requerir("fecha_jornada", "Elija la fecha de la jornada");
  if (d.fecha_jornada && d.fecha_jornada > new Date().toISOString().slice(0, 10)) e.fecha_jornada = "La fecha no puede ser futura";
  numero("hogares_visitados");
  numero("personas_contactadas");
  numero("personas_aceptan_visita");
  requerir("resultado_espiritual", "Describa el resultado espiritual");
  if (!["1", "2", "3", "4", "5"].includes(d.receptividad)) e.receptividad = "Califique de 1 a 5";
  requerir("dificultad", "Elija una opción");
  if (d.dificultad === "otra") requerir("dificultad_otra", "Describa la dificultad");
  if (d.evangelismo_ninos) numero("ninos_alcanzados");
  if (d.caso_enfermo || d.caso_sordo || d.caso_consejeria) requerir("descripcion_caso", "Describa brevemente el caso");
  if (d.origen === "app" && d.manzanas.length === 0) e.manzanas = "Toque en el mapa al menos una manzana";
  return e;
}

export function construirCasos(d: DatosReporte): { tipo: TipoCaso; descripcion: string }[] {
  const tipos: [boolean, TipoCaso][] = [[d.caso_enfermo, "enfermo"], [d.caso_sordo, "sordo"], [d.caso_consejeria, "consejeria"]];
  return tipos.filter(([marcado]) => marcado).map(([, tipo]) => ({ tipo, descripcion: d.descripcion_caso.trim() }));
}
```

- [ ] **Step 3: Verificar**

Run: `npm test -- validar`
Expected: PASS.

- [ ] **Step 4: Formulario**

`src/components/FormularioReporte.tsx` (componente cliente). Props: `perfil: Perfil`, `inicial?: DatosReporte`, `reporteId?: string`, `alGuardar(id: string)`.

- Secciones en este orden, con los textos del Google Form: Datos generales, Cobertura del trabajo, Casos especiales, Evangelismo infantil, Evaluación.
- Zona: fija para coordinadores (`perfil.zona_id`); selector para administradores.
- Responsable y coordinador: precargados con `perfil.nombre_completo` y editables.
- Mapa: `MapaManzanas` cargado con `dynamic(..., { ssr: false })`, solo con las manzanas de la zona elegida. `alTocar` agrega o quita la manzana de `manzanas`, y debajo del mapa se muestran los códigos elegidos.
- Al cambiar de zona se vacía la selección.
- Al enviar: `validarReporte`; si hay errores, se muestran junto a cada campo y se lleva el foco al primero. Si no los hay, se llama:

```ts
const { data, error } = await db.rpc("guardar_reporte", {
  p_id: reporteId ?? null,
  p_reporte: {
    zona_id: d.zona_id, responsable_nombre: d.responsable_nombre.trim(), coordinador_nombre: d.coordinador_nombre.trim(),
    fecha_jornada: d.fecha_jornada, direccion: d.direccion.trim() || null, hogares_visitados: +d.hogares_visitados,
    personas_contactadas: +d.personas_contactadas, personas_aceptan_visita: +d.personas_aceptan_visita,
    nombres_visita: d.nombres_visita.trim() || null, resultado_espiritual: d.resultado_espiritual.trim(),
    evangelismo_ninos: d.evangelismo_ninos, ninos_alcanzados: d.evangelismo_ninos ? +d.ninos_alcanzados : null,
    receptividad: +d.receptividad, dificultad: d.dificultad,
    dificultad_otra: d.dificultad === "otra" ? d.dificultad_otra.trim() : null, sugerencias: d.sugerencias.trim() || null,
  },
  p_manzanas: d.manzanas,
  p_casos: construirCasos(d),
});
```

- Si hay `error`, el formulario conserva lo escrito y muestra: "No se pudo guardar. Revise su conexión e intente de nuevo." El botón queda deshabilitado solo mientras se envía, para evitar duplicados.

- [ ] **Step 5: Pantallas**

- `nuevo-reporte/page.tsx`: `FormularioReporte`; al guardar va a `/reportes/[id]`.
- `reportes/page.tsx`: lista paginada de 20 en 20, ordenada por fecha descendente, con filtros de zona, fechas y "pendientes de marcar manzanas" (`manzanas_pendientes = true`). RLS ya limita lo que ve cada rol.
- `reportes/[id]/page.tsx`: detalle con manzanas y casos. Botón Editar si `perfil.rol === "administrador"` o `creado_por === perfil.id`; abre `FormularioReporte` con los datos convertidos a `DatosReporte`. Botón Eliminar solo para administrador, con confirmación.
- `casos/page.tsx`: lista filtrable por zona, tipo y estado, con el botón "Marcar atendido" o "Marcar pendiente", que actualiza `estado` y `atendido_en`.

- [ ] **Step 6: Comprobar y commit**

Con `npm run dev`, ingresar con usuario de prueba, crear un reporte a 360 px de ancho y comprobar que la manzana pasa a verde en `/mapa`.

```bash
git add -A && git commit -m "feat: reportes con selección de manzanas y casos especiales"
```

---

### Task 6: Estadísticas e informes

**Files:**
- Create: `src/lib/informes/resumen.ts`, `src/lib/informes/pdf.ts`, `src/lib/informes/excel.ts`
- Create: `src/app/(app)/estadisticas/page.tsx`, `src/app/(app)/informes/page.tsx`
- Test: `src/lib/informes/resumen.test.ts`

**Interfaces:**
- Consumes: RPC `estadisticas`, tablas `reportes` y `casos_especiales`.
- Produces: tipo `Estadisticas`, `filasPorZona(e: Estadisticas): (string | number)[][]`, `generarPdf(datos): void`, `generarExcel(datos): Promise<void>`.

- [ ] **Step 1: Escribir la prueba que falla**

`src/lib/informes/resumen.test.ts`:

```ts
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
```

Run: `npm test -- resumen`
Expected: FAIL, módulo no encontrado.

- [ ] **Step 2: Implementar el resumen**

`src/lib/informes/resumen.ts`:

```ts
export type Estadisticas = {
  totales: { jornadas: number; hogares: number; personas: number; visitas: number; ninos: number; receptividad: number | null; pendientes_marcar: number };
  por_zona: { numero: number; nombre: string; manzanas_total: number; manzanas_alcanzadas: number; jornadas: number; personas: number }[];
  por_mes: { mes: string; jornadas: number; personas: number; hogares: number }[];
  dificultades: { dificultad: string; cantidad: number }[];
  casos: { tipo: string; cantidad: number; pendientes: number }[];
};

export const filasPorZona = (e: Estadisticas): (string | number)[][] =>
  e.por_zona.map((z) => [z.nombre, z.jornadas, z.personas, z.manzanas_alcanzadas, z.manzanas_total,
    `${z.manzanas_total ? Math.round((z.manzanas_alcanzadas / z.manzanas_total) * 100) : 0}%`]);

export const nombreArchivo = (ext: string, desde: string, hasta: string) => `informe-evangelismo-${desde}-a-${hasta}.${ext}`;
```

Run: `npm test -- resumen`
Expected: PASS.

- [ ] **Step 3: Pantalla de estadísticas**

`estadisticas/page.tsx` (cliente). Usa `SelectorPeriodo`, selector de zona y `rpc("estadisticas", { p_desde, p_hasta, p_zona })`. Muestra:

- Tarjetas: jornadas, hogares, personas, visitas aceptadas, niños y receptividad promedio.
- Barras con Recharts: jornadas por mes y manzanas alcanzadas por zona.
- Tabla de dificultades con `ETIQUETA_DIFICULTAD` y tabla de casos con `ETIQUETA_CASO`.
- Aviso si `pendientes_marcar > 0`: "N reportes importados aún no tienen manzanas marcadas y no aparecen en el mapa."
- Estado vacío: "No hay reportes en este período."

Antes de escribir las gráficas, cargar la skill `dataviz`.

- [ ] **Step 4: Generadores**

`src/lib/informes/pdf.ts`: `generarPdf({ estadisticas, desde, hasta, zonaNombre, casos? })`. Con jsPDF y autoTable arma el título "Informe de evangelismo, IPUC Barrio Dangond", el período, la tabla de totales, la tabla por zona con los encabezados Zona, Jornadas, Personas, Manzanas alcanzadas, Total manzanas y Avance usando `filasPorZona`, la tabla por mes, la de dificultades y, solo si `casos` viene definido, la de casos especiales. Guarda con `nombreArchivo("pdf", ...)`.

`src/lib/informes/excel.ts`: `generarExcel({ estadisticas, reportes, casos?, desde, hasta })`. Con ExcelJS crea las hojas Resumen, Por zona y Reportes (una fila por reporte con todos los campos y los códigos de manzana) y, solo si `casos` viene definido, Casos especiales. Descarga con un `Blob`. Para evitar la inyección de fórmulas, todo texto proveniente de los reportes que empiece por `=`, `+`, `-` o `@` se escribe con un apóstrofo delante.

- [ ] **Step 5: Pantalla de informes**

`informes/page.tsx`: redirige a `/mapa` si el usuario no es administrador. Tiene período, zona, la casilla "Incluir casos especiales" (desmarcada por defecto) y los botones "Descargar PDF", "Descargar Excel" y "Exportar todos los datos (copia de seguridad)". Este último genera el Excel con todos los reportes y casos, sin filtro de fechas.

- [ ] **Step 6: Comprobar y commit**

Descargar los dos formatos con datos de prueba y abrirlos. Comprobar que las cifras coinciden con la pantalla de estadísticas y que sin la casilla marcada el contenido no incluye descripciones de casos.

```bash
git add -A && git commit -m "feat: estadísticas e informes en PDF y Excel"
```

---

### Task 7: Administración e importación desde Google Forms

**Files:**
- Create: `src/lib/importar/leer.ts`, `src/app/(app)/administracion/page.tsx`, `src/app/(app)/administracion/importar/page.tsx`, `src/app/(app)/cuenta/page.tsx`, `src/app/api/admin/usuarios/route.ts`
- Test: `src/lib/importar/leer.test.ts`

**Interfaces:**
- Consumes: RPC `importar_reportes`, `crearClienteServicio`, `obtenerPerfil`.
- Produces: `traducirFila(fila: Record<string, unknown>, zonas: {id: string; numero: number}[]): Promise<ResultadoFila>`.

- [ ] **Step 1: Escribir la prueba que falla**

`src/lib/importar/leer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { traducirFila } from "./leer";

const zonas = [{ id: "z1", numero: 1 }];
const fila = (c: Record<string, unknown> = {}) => ({
  "Marca temporal": "15/03/2026 10:00:00", "Nombre completo ": "Ana Díaz", "  Zona / Bloque asignado  ": "Zona 1",
  "  Nombre del coordinador de zona  ": "Luis", "  Fecha de la jornada evangelística   ": "2026-03-15",
  "  Manzana(s) trabajada(s)  ": "Calle 16 # 20", "  Cantidad de hogares visitados  ": "5",
  "  Cantidad de personas contactadas  ": "8", "  Personas que aceptaron visita posterior  ": "2",
  "  Breve descripción del resultado espiritual  ": "Oraron",
  "  ¿Se encontró alguna persona enferma que requiera visita hospitalaria?  ": "No",
  "  ¿Se identificó alguna persona sorda?  ": "No",
  "  ¿Se detectó algún caso que requiera consejería o visitación especial?  ": "No",
  "  Si respondió SÍ a alguna anterior, describa brevemente el caso  ": "N/A",
  "  ¿Se realizó evangelismo a niños en la zona?  ": "No", "  Cantidad aproximada de niños alcanzados  ": "0",
  "  ¿Cómo evalúa la receptividad del sector?  ": "4", "  Dificultades encontradas durante la jornada  ": "Poco tiempo",
  "  Sugerencias para mejorar el trabajo en esta zona  ": "Más gente", ...c,
});

describe("traducirFila", () => {
  it("traduce una fila válida ignorando espacios en encabezados", async () => {
    const r = await traducirFila(fila(), zonas);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.reporte).toMatchObject({ zona_id: "z1", responsable_nombre: "Ana Díaz", fecha_jornada: "2026-03-15",
      direccion: "Calle 16 # 20", hogares_visitados: 5, personas_aceptan_visita: 2, dificultad: "poco_tiempo", receptividad: 4 });
    expect(r.reporte.huella_importacion).toMatch(/^[0-9a-f]{64}$/);
    expect(r.casos).toEqual([]);
  });
  it("rechaza una zona inválida", async () => {
    const r = await traducirFila(fila({ "  Zona / Bloque asignado  ": "Zona 9" }), zonas);
    expect(r.ok).toBe(false);
  });
  it("rechaza una fecha inválida y acepta el formato dd/mm/aaaa", async () => {
    expect((await traducirFila(fila({ "  Fecha de la jornada evangelística   ": "ayer" }), zonas)).ok).toBe(false);
    const r = await traducirFila(fila({ "  Fecha de la jornada evangelística   ": "15/03/2026" }), zonas);
    expect(r.ok && r.reporte.fecha_jornada).toBe("2026-03-15");
  });
  it("guarda como nombres un texto en personas que aceptaron visita", async () => {
    const r = await traducirFila(fila({ "  Personas que aceptaron visita posterior  ": "Juan y Rosa" }), zonas);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.reporte.personas_aceptan_visita).toBeNull();
    expect(r.reporte.nombres_visita).toBe("Juan y Rosa");
  });
  it("deja vacío y advierte un número que no lo es", async () => {
    const r = await traducirFila(fila({ "  Cantidad de personas contactadas  ": "varias" }), zonas);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.reporte.personas_contactadas).toBeNull();
    expect(r.advertencias.join()).toMatch(/personas contactadas/i);
  });
  it("crea un caso por cada Sí", async () => {
    const r = await traducirFila(fila({ "  ¿Se identificó alguna persona sorda?  ": "Si",
      "  Si respondió SÍ a alguna anterior, describa brevemente el caso  ": "Vecina" }), zonas);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.casos).toEqual([{ tipo: "sordo", descripcion: "Vecina" }]);
  });
  it("trata una dificultad desconocida como otra", async () => {
    const r = await traducirFila(fila({ "  Dificultades encontradas durante la jornada  ": "Lluvia y barro" }), zonas);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.reporte).toMatchObject({ dificultad: "otra", dificultad_otra: "Lluvia y barro" });
  });
  it("la misma fila produce la misma huella", async () => {
    const a = await traducirFila(fila(), zonas), b = await traducirFila(fila(), zonas);
    expect(a.ok && b.ok && a.reporte.huella_importacion === b.reporte.huella_importacion).toBe(true);
  });
});
```

Run: `npm test -- leer`
Expected: FAIL, módulo no encontrado.

- [ ] **Step 2: Implementar**

`src/lib/importar/leer.ts`:

```ts
import type { Dificultad, TipoCaso } from "@/lib/tipos";

export type ReporteImportado = {
  zona_id: string; responsable_nombre: string; coordinador_nombre: string; fecha_jornada: string; direccion: string | null;
  hogares_visitados: number | null; personas_contactadas: number | null; personas_aceptan_visita: number | null;
  nombres_visita: string | null; resultado_espiritual: string | null; evangelismo_ninos: boolean; ninos_alcanzados: number | null;
  receptividad: number | null; dificultad: Dificultad | null; dificultad_otra: string | null; sugerencias: string | null;
  huella_importacion: string;
};
export type ResultadoFila =
  | { ok: true; reporte: ReporteImportado; casos: { tipo: TipoCaso; descripcion: string }[]; advertencias: string[] }
  | { ok: false; motivo: string };

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const DIFICULTADES: Record<string, Dificultad> = {
  "poco tiempo": "poco_tiempo", "falta de acompañamiento": "falta_acompanamiento", "rechazo de las personas": "rechazo",
  "condiciones climáticas": "clima", ninguna: "ninguna", otra: "otra",
};

function aFecha(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v)) return v.toISOString().slice(0, 10);
  const t = String(v ?? "").trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const lat = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (lat) return `${lat[3]}-${lat[2].padStart(2, "0")}-${lat[1].padStart(2, "0")}`;
  return null;
}

async function sha256(texto: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function traducirFila(fila: Record<string, unknown>, zonas: { id: string; numero: number }[]): Promise<ResultadoFila> {
  const datos = new Map(Object.entries(fila).map(([k, v]) => [normalizar(k), v]));
  const tx = (clave: string) => String(datos.get(clave) ?? "").trim();
  const advertencias: string[] = [];
  const num = (clave: string, etiqueta: string) => {
    const t = tx(clave);
    if (!t) return null;
    if (/^\d+$/.test(t)) return +t;
    advertencias.push(`${etiqueta}: "${t}" no es un número`);
    return null;
  };
  const si = (clave: string) => normalizar(tx(clave)).startsWith("s");

  const numZona = tx("zona / bloque asignado").match(/^zona\s*(\d)$/i)?.[1];
  const zona = zonas.find((z) => z.numero === Number(numZona));
  if (!zona) return { ok: false, motivo: `Zona inválida: "${tx("zona / bloque asignado")}"` };
  const fecha = aFecha(datos.get("fecha de la jornada evangelística"));
  if (!fecha) return { ok: false, motivo: `Fecha inválida: "${tx("fecha de la jornada evangelística")}"` };

  const visita = tx("personas que aceptaron visita posterior");
  const esNumeroVisita = /^\d+$/.test(visita);
  const difTexto = tx("dificultades encontradas durante la jornada");
  const dificultad = difTexto ? DIFICULTADES[normalizar(difTexto)] ?? "otra" : null;
  const receptividad = num("¿cómo evalúa la receptividad del sector?", "Receptividad");
  const nombre = tx("nombre completo");

  const descripcion = tx("si respondió sí a alguna anterior, describa brevemente el caso");
  const casos: { tipo: TipoCaso; descripcion: string }[] = [];
  if (si("¿se encontró alguna persona enferma que requiera visita hospitalaria?")) casos.push({ tipo: "enfermo", descripcion });
  if (si("¿se identificó alguna persona sorda?")) casos.push({ tipo: "sordo", descripcion });
  if (si("¿se detectó algún caso que requiera consejería o visitación especial?")) casos.push({ tipo: "consejeria", descripcion });

  return {
    ok: true, casos, advertencias,
    reporte: {
      zona_id: zona.id, responsable_nombre: nombre, coordinador_nombre: tx("nombre del coordinador de zona"), fecha_jornada: fecha,
      direccion: tx("manzana(s) trabajada(s)") || null,
      hogares_visitados: num("cantidad de hogares visitados", "Hogares visitados"),
      personas_contactadas: num("cantidad de personas contactadas", "Personas contactadas"),
      personas_aceptan_visita: esNumeroVisita ? +visita : null,
      nombres_visita: visita && !esNumeroVisita ? visita : null,
      resultado_espiritual: tx("breve descripción del resultado espiritual") || null,
      evangelismo_ninos: si("¿se realizó evangelismo a niños en la zona?"),
      ninos_alcanzados: num("cantidad aproximada de niños alcanzados", "Niños alcanzados"),
      receptividad: receptividad && receptividad >= 1 && receptividad <= 5 ? receptividad : null,
      dificultad, dificultad_otra: dificultad === "otra" && normalizar(difTexto) !== "otra" ? difTexto : null,
      sugerencias: tx("sugerencias para mejorar el trabajo en esta zona") || null,
      huella_importacion: await sha256([tx("marca temporal"), nombre, fecha].join("|")),
    },
  };
}
```

Run: `npm test -- leer`
Expected: PASS.

- [ ] **Step 3: Pantalla de importación**

`administracion/importar/page.tsx` (cliente, solo administrador):

1. Selector de archivo `.csv` o `.xlsx`. CSV con `Papa.parse(archivo, { header: true, skipEmptyLines: true })`. XLSX con `ExcelJS`, usando la primera fila como encabezado.
2. Se ejecuta `traducirFila` en cada fila. Vista previa con conteos (válidas, con advertencias, rechazadas) y lista de rechazadas y advertencias con su número de fila.
3. Botón "Importar N reportes", que llama a `rpc("importar_reportes", { p_filas: filas.map(f => ({ reporte: f.reporte, casos: f.casos })) })` en lotes de 200.
4. Mensaje final: "Se importaron X reportes nuevos. Y ya estaban en el sistema." con un enlace a `/reportes` filtrado por pendientes.

- [ ] **Step 4: Gestión de usuarios**

`src/app/api/admin/usuarios/route.ts`:

```ts
import { NextResponse } from "next/server";
import { obtenerPerfil } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";

export async function POST(req: Request) {
  const yo = await obtenerPerfil();
  if (yo?.rol !== "administrador") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { email, password, nombre_completo, rol, zona_id } = await req.json();
  if (!email || !nombre_completo || !["coordinador", "administrador"].includes(rol) || typeof password !== "string" || password.length < 8
      || (rol === "coordinador" && !zona_id)) {
    return NextResponse.json({ error: "Datos incompletos o contraseña menor de 8 caracteres" }, { status: 400 });
  }
  const db = crearClienteServicio();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return NextResponse.json({ error: "No se pudo crear el usuario. Revise si el correo ya existe." }, { status: 400 });
  const r = await db.from("perfiles").insert({ id: data.user.id, nombre_completo, rol, zona_id: rol === "coordinador" ? zona_id : null });
  if (r.error) {
    await db.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: "No se pudo crear el perfil" }, { status: 500 });
  }
  return NextResponse.json({ id: data.user.id }, { status: 201 });
}
```

`administracion/page.tsx` (solo administrador):

- Lista de perfiles con botón Activar o Desactivar, que hace `update` en `perfiles` y bloquea desactivarse a sí mismo.
- Formulario para crear usuario contra la ruta anterior.
- Sección de manzanas: buscar por código y activar o desactivar.
- Enlace a importación.

`cuenta/page.tsx`: cambio de contraseña con `db.auth.updateUser({ password })`, mínimo 8 caracteres.

- [ ] **Step 5: Comprobar y commit**

Importar un CSV de prueba dos veces. La segunda vez debe reportar 0 reportes nuevos. Comprobar que un coordinador recibe 403 en `POST /api/admin/usuarios`.

```bash
git add -A && git commit -m "feat: administración de usuarios e importación de Google Forms"
```

---

### Task 8: Publicación en Vercel y verificación final

**Files:**
- Create: `vercel.json`, `src/app/api/mantener-activo/route.ts`, `README.md`

**Interfaces:**
- Consumes: `crearClienteServicio`.

- [ ] **Step 1: Tarea que evita la pausa**

`src/app/api/mantener-activo/route.ts`:

```ts
import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabase/servicio";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 401 });
  }
  const { error } = await crearClienteServicio().from("zonas").select("id", { head: true, count: "exact" });
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
```

`vercel.json`:

```json
{ "crons": [{ "path": "/api/mantener-activo", "schedule": "0 12 * * *" }] }
```

- [ ] **Step 2: Comprobaciones previas**

Run: `npm test && npm run test:seguridad && npm run build`
Expected: todo pasa.

Run: `git grep -nE "service_role|SUPABASE_SERVICE_ROLE_KEY=.+|eyJ[A-Za-z0-9_-]{20,}"`
Expected: sin secretos; solo referencias al nombre de la variable.

Comprobar en el build que la clave no llegó al navegador. Run: `grep -rl "SUPABASE_SERVICE_ROLE_KEY" .next/static || echo limpio`
Expected: `limpio`.

- [ ] **Step 3: Publicar**

El usuario inicia sesión con `npx vercel login`. Luego `npx vercel link`, se cargan las cuatro variables de entorno con `npx vercel env add` y se publica con `npx vercel --prod`. Las variables las escribe el usuario en su terminal. `CRON_SECRET` se genera con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

En Supabase, Authentication > URL Configuration, registrar la URL de Vercel como Site URL.

El usuario ejecuta `node scripts/crear-admin.mjs correo Nombre Completo` en su terminal.

- [ ] **Step 4: Verificación de punta a punta en el sitio publicado**

A 360 px de ancho, con usuarios de prueba:

1. Sin sesión, `/mapa` redirige a `/ingreso`.
2. Coordinador: crea un reporte, marca manzanas y estas aparecen en verde en `/mapa`.
3. Coordinador de otra zona: ve la manzana verde y las cifras agregadas, pero no el reporte ni el caso.
4. Administrador: ve todo, descarga PDF y Excel, y las cifras coinciden con la pantalla.
5. `GET /api/mantener-activo` sin secreto devuelve 401.
6. Borrar los datos y usuarios de prueba.

- [ ] **Step 5: Documentar y commit**

`README.md`: qué es, cómo ejecutarlo localmente, variables de entorno, cómo regenerar manzanas, cómo cambiar colores de zona y recomendación de copia mensual.

```bash
git add -A && git commit -m "feat: publicación en Vercel y tarea de mantenimiento"
```

---

## Hitos que dependen del usuario

- **Task 2, Step 1:** iniciar sesión en Supabase, crear el proyecto y copiar claves a `.env.local`.
- **Task 2, Step 6 y Task 8, Step 3:** crear el primer administrador en su terminal.
- **Task 8, Step 3:** iniciar sesión en Vercel y cargar variables.
- **Después de publicar:** revisar manzanas en `/revision.html`, confirmar colores de zona y entregar el archivo de Google Forms.
