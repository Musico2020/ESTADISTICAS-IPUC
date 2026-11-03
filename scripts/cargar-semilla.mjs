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
// Borra las manzanas que ya no existen. Si alguna tiene reportes, la base de datos lo rechaza.
const { data: actuales, error: e2 } = await db.from("manzanas").select("codigo");
if (e2) throw e2;
const vigentes = new Set(filas.map((f) => f.codigo));
const sobrantes = actuales.map((m) => m.codigo).filter((c) => !vigentes.has(c));
if (sobrantes.length) comprobar(await db.from("manzanas").delete().in("codigo", sobrantes));
console.log(`Zonas: ${zonas.length}, manzanas: ${filas.length}`);
