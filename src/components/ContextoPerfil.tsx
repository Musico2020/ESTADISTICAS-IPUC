"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Perfil } from "@/lib/tipos";

const Contexto = createContext<Perfil | null>(null);

export function ProveedorPerfil({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  return <Contexto.Provider value={perfil}>{children}</Contexto.Provider>;
}

export function usePerfil(): Perfil {
  const perfil = useContext(Contexto);
  if (!perfil) throw new Error("usePerfil requiere ProveedorPerfil");
  return perfil;
}
