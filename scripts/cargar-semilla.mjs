import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ path: ".env.local" });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const leer = (n) => JSON.parse(fs.readFileSync(`supabase/seed/${n}.json`, "utf8"));
const comprobar = ({ error }) => { if (error) throw error; };
const mapa = async (tabla) => {
  const { data, error } = await db.from(tabla).select("id,numero");
  if (error) throw error;
  return new Map(data.map((x) => [x.numero, x.id]));
};

comprobar(await db.from("sectores").upsert(leer("sectores"), { onConflict: "numero" }));
const idSector = await mapa("sectores");
const zonas = leer("zonas").map(({ sector_numero, ...z }) => ({ ...z, sector_id: idSector.get(sector_numero) }));
comprobar(await db.from("zonas").upsert(zonas, { onConflict: "numero" }));
const idZona = await mapa("zonas");
const filas = leer("manzanas").map((m) => ({ codigo: m.codigo, geometria: m.geometria, zona_id: idZona.get(m.zona_numero) }));
comprobar(await db.from("manzanas").upsert(filas, { onConflict: "codigo" }));
// Borra las manzanas que ya no existen. Si alguna tiene reportes, la base de datos lo rechaza.
const { data: actuales, error: e2 } = await db.from("manzanas").select("codigo");
if (e2) throw e2;
const vigentes = new Set(filas.map((f) => f.codigo));
const sobrantes = actuales.map((m) => m.codigo).filter((c) => !vigentes.has(c));
if (sobrantes.length) comprobar(await db.from("manzanas").delete().in("codigo", sobrantes));
console.log(`Sectores: ${idSector.size}, zonas: ${idZona.size}, manzanas: ${filas.length}, borradas: ${sobrantes.length}`);
