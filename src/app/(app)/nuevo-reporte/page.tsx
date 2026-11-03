"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusCircle, ArrowLeft } from "lucide-react";
import FormularioReporte from "@/components/FormularioReporte";

export default function NuevoReporte() {
  const router = useRouter();
  return (
    <div className="pila">
      <div>
        <Link
          href="/reportes"
          className="boton secundario"
          style={{ minHeight: 36, padding: "4px 12px", fontSize: "0.82rem", marginBottom: 12, display: "inline-flex" }}
        >
          <ArrowLeft size={15} />
          <span>Volver a reportes</span>
        </Link>
        <h1>
          <PlusCircle size={28} style={{ color: "var(--marca)" }} />
          <span>Nuevo Reporte de Evangelismo</span>
        </h1>
        <p className="tenue">
          Registre la actividad evangelística, manzanas alcanzadas y casos especiales detectados
        </p>
      </div>

      <FormularioReporte alGuardar={(id) => router.push(`/reportes/${id}`)} />
    </div>
  );
}
