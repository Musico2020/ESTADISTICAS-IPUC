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
