import { NextResponse } from "next/server";
import { obtenerPerfil } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { aCorreo } from "@/lib/usuarios";

export async function POST(req: Request) {
  const yo = await obtenerPerfil();
  if (yo?.rol !== "administrador") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { usuario, password, nombre_completo, rol, zona_id } = await req.json();
  if (!usuario?.trim() || !nombre_completo || !["coordinador", "administrador", "usuario"].includes(rol) || typeof password !== "string" || password.length < 8
      || (rol === "coordinador" && !zona_id)) {
    return NextResponse.json({ error: "Datos incompletos o contraseña menor de 8 caracteres" }, { status: 400 });
  }
  const db = crearClienteServicio();
  const { data, error } = await db.auth.admin.createUser({ email: aCorreo(usuario), password, email_confirm: true });
  if (error) return NextResponse.json({ error: "No se pudo crear el usuario. Revise si el usuario ya existe." }, { status: 400 });
  const r = await db.from("perfiles").insert({ id: data.user.id, nombre_completo, rol, zona_id: rol === "coordinador" ? zona_id : null });
  if (r.error) {
    await db.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: "No se pudo crear el perfil" }, { status: 500 });
  }
  return NextResponse.json({ id: data.user.id }, { status: 201 });
}
