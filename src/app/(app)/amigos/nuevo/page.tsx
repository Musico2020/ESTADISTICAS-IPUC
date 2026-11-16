"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import FormularioPersona from "@/components/personas/FormularioPersona";

export default function NuevoAmigo() {
  return <Suspense><Contenido /></Suspense>;
}

function Contenido() {
  const router = useRouter();
  // Desde el detalle de un culto se llega con ?culto=<id> para dejar registrado dónde se conoció.
  const culto = useSearchParams().get("culto");
  return (
    <div className="pila">
      <h1><HeartHandshake size={28} /><span>Registrar amigo</span></h1>
      {culto && <p className="tenue">Quedará vinculado al culto donde asistió.</p>}
      <FormularioPersona cultoId={culto} alGuardar={(id) => router.push(`/amigos/${id}`)} />
    </div>
  );
}
