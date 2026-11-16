// Compila el .apk de la app móvil con la conexión a Supabase de .env.local y lo copia al Escritorio.
// La URL y la clave pública no se guardan en el código: se pasan al compilar.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
if (!fs.existsSync("movil/android/key.properties")) console.warn("Sin movil/android/key.properties: el .apk saldrá firmado con la llave de depuración.");

execFileSync("flutter", ["build", "apk", "--release", `--dart-define=SUPABASE_URL=${url}`, `--dart-define=SUPABASE_ANON_KEY=${clave}`],
  { cwd: "movil", stdio: "inherit", shell: true });

const version = fs.readFileSync("movil/pubspec.yaml", "utf8").match(/^version:\s*(\S+)/m)[1];
const destino = path.join(os.homedir(), "Desktop", `Evangelismo-IPUC-${version}.apk`);
fs.copyFileSync("movil/build/app/outputs/flutter-apk/app-release.apk", destino);
console.log("APK listo:", destino);
