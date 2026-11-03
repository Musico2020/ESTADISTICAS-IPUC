"use client";
import { useRouter } from "next/navigation";
import FormularioReporte from "@/components/FormularioReporte";

export default function NuevoReporte() {
  const router = useRouter();
  return (
    <div className="pila">
      <h1>Nuevo reporte</h1>
      <FormularioReporte alGuardar={(id) => router.push(`/reportes/${id}`)} />
    </div>
  );
}
