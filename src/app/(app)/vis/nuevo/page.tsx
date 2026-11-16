"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import FormularioHogar from "@/components/hogares/FormularioHogar";

export default function NuevoHogar() {
  return <Suspense><Contenido /></Suspense>;
}

function Contenido() {
  const router = useRouter();
  // Desde el detalle de un culto se llega con ?culto=<id> para dejar registrado dónde se conoció la familia.
  const culto = useSearchParams().get("culto");
  return (
    <div className="pila">
      <div>
        <h1><Users size={28} /><span>Registrar hogar visitado</span></h1>
        <p className="tenue">Anote la familia completa: adultos, jóvenes y niños que viven en la casa.</p>
      </div>
      <FormularioHogar cultoId={culto} alGuardar={(id) => router.push(`/vis/${id}`)} />
    </div>
  );
}
