import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { obtenerPerfil } from "@/lib/supabase/servidor";
import Navegacion from "@/components/Navegacion";
import { ProveedorPerfil } from "@/components/ContextoPerfil";

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/ingreso");
  return (
    <ProveedorPerfil perfil={perfil}>
      <Navegacion perfil={perfil} />
      <main className="contenido">{children}</main>
    </ProveedorPerfil>
  );
}
