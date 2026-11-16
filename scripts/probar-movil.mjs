// Ejecuta las pruebas de integración de la app móvil contra Supabase con cuentas temporales,
// y las borra al terminar junto con todo lo que registraron.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ path: ".env.local", quiet: true });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DOMINIO = "usuarios-ipuc.example.com";
const marca = `MOVIL${randomUUID().slice(0, 6)}`;
const creados = [];
const zona = async (n) => (await db.from("zonas").select("id,sector_id").eq("numero", n).single()).data;

async function cuenta(rol, { zona_id = null, sector_id = null } = {}) {
  const usuario = `prueba${randomUUID().slice(0, 8)}`, clave = randomUUID();
  const { data, error } = await db.auth.admin.createUser({ email: `${usuario}@${DOMINIO}`, password: clave, email_confirm: true });
  if (error) throw error;
  creados.push(data.user.id);
  const r = await db.from("perfiles").insert({ id: data.user.id, nombre_completo: "Prueba móvil", rol, zona_id, sector_id });
  if (r.error) throw r.error;
  return { usuario, clave };
}

let codigo = 0;
try {
  const z1 = await zona(1), z4 = await zona(4);
  const lider = await cuenta("lider_zona", { zona_id: z1.id });
  const coordinador = await cuenta("coordinador_sector", { sector_id: z1.sector_id });
  const ajeno = await cuenta("lider_zona", { zona_id: z4.id });
  execFileSync("flutter", ["test", "test/integracion_test.dart"], {
    cwd: "movil", stdio: "inherit", shell: true,
    env: {
      ...process.env, IPUC_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, IPUC_CLAVE_PUBLICA: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, IPUC_MARCA: marca,
      IPUC_LIDER: lider.usuario, IPUC_LIDER_CLAVE: lider.clave, IPUC_ZONA: z1.id, IPUC_OTRA_ZONA: z4.id,
      IPUC_COORDINADOR: coordinador.usuario, IPUC_COORDINADOR_CLAVE: coordinador.clave,
      IPUC_AJENO: ajeno.usuario, IPUC_AJENO_CLAVE: ajeno.clave,
    },
  });
} catch {
  codigo = 1;
} finally {
  await db.from("reportes").delete().in("creado_por", creados);
  await db.from("cultos").delete().like("direccion", `${marca}%`);
  await db.from("personas").delete().like("nombre", `${marca}%`);
  for (const id of creados) await db.auth.admin.deleteUser(id);
  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  console.log("Cuentas restantes:", data.users.length);
}
process.exit(codigo);
