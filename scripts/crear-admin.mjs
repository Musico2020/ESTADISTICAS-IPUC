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
