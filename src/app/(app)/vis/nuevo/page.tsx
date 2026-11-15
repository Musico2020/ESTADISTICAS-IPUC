"use client";
import { useRouter } from "next/navigation";
import { Baby } from "lucide-react";
import FormularioPersona from "@/components/personas/FormularioPersona";

export default function NuevoVis() {
  const router = useRouter();
  return (
    <div className="pila">
      <h1><Baby size={28} style={{ color: "var(--marca)" }} /><span>Registrar niño visitado (VIS)</span></h1>
      <FormularioPersona tipo="nino_vis" alGuardar={(id) => router.push(`/vis/${id}`)} />
    </div>
  );
}
