"use client";
import { useRouter } from "next/navigation";
import { Home } from "lucide-react";
import FormularioCulto from "@/components/FormularioCulto";

export default function NuevoCulto() {
  const router = useRouter();
  return (
    <div className="pila">
      <h1><Home size={28} style={{ color: "var(--marca)" }} /><span>Registrar culto en casa</span></h1>
      <FormularioCulto alGuardar={(id) => router.push(`/cultos/${id}`)} />
    </div>
  );
}
