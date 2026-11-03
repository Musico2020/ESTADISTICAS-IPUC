"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePerfil } from "@/components/ContextoPerfil";
import SelectorPeriodo, { type Periodo } from "@/components/SelectorPeriodo";
import { cargarDatosInforme } from "@/lib/informes/datos";
import { periodoDeAnio } from "@/lib/mapa/periodo";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Zona } from "@/lib/tipos";

export default function PaginaInformes() {
  const perfil = usePerfil();
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDeAnio(new Date().getFullYear()));
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zona, setZona] = useState("");
  const [incluirCasos, setIncluirCasos] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const esAdmin = perfil.rol === "administrador";

  useEffect(() => {
    if (!esAdmin) { router.replace("/mapa"); return; }
    void crearClienteNavegador().from("zonas").select("*").order("numero").then(({ data }) => setZonas((data ?? []) as Zona[]));
  }, [esAdmin, router]);

  if (!esAdmin) return null;

  async function ejecutar(accion: () => Promise<void>) {
    setOcupado(true);
    setError("");
    try {
      await accion();
    } catch {
      setError("No se pudo generar el archivo. Revise su conexión e intente de nuevo.");
    }
    setOcupado(false);
  }
  const zonaNombre = zonas.find((z) => z.id === zona)?.nombre ?? "Todas";
  const datos = () => cargarDatosInforme(crearClienteNavegador(), { ...periodo, zona, zonaNombre, incluirCasos });

  const pdf = () => ejecutar(async () => {
    const [{ generarPdf }, d] = await Promise.all([import("@/lib/informes/pdf"), datos()]);
    generarPdf(d);
  });
  const excel = () => ejecutar(async () => {
    const [{ generarExcel }, d] = await Promise.all([import("@/lib/informes/excel"), datos()]);
    await generarExcel(d);
  });
  const copia = () => ejecutar(async () => {
    const [{ generarExcel }, d] = await Promise.all([
      import("@/lib/informes/excel"),
      cargarDatosInforme(crearClienteNavegador(), { desde: "2000-01-01", hasta: "2100-12-31", zona: "", zonaNombre: "Todas", incluirCasos: true }),
    ]);
    await generarExcel(d);
  });

  return (
    <div className="pila">
      <h1>Informes</h1>
      <div className="tarjeta pila">
        <div className="fila">
          <SelectorPeriodo alCambiar={setPeriodo} />
          <label className="campo"><span>Zona</span>
            <select value={zona} onChange={(e) => setZona(e.target.value)}>
              <option value="">Todas</option>
              {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </select>
          </label>
        </div>
        <label className="casilla"><input type="checkbox" checked={incluirCasos} onChange={(e) => setIncluirCasos(e.target.checked)} />
          Incluir casos especiales (datos delicados)</label>
        <div className="fila">
          <button className="boton" disabled={ocupado} onClick={() => void pdf()}>Descargar PDF</button>
          <button className="boton" disabled={ocupado} onClick={() => void excel()}>Descargar Excel</button>
        </div>
      </div>
      <div className="tarjeta pila">
        <h2>Copia de seguridad</h2>
        <p className="tenue">Se recomienda descargarla cada mes y guardarla en un lugar privado. Incluye todos los reportes y casos especiales.</p>
        <div><button className="boton secundario" disabled={ocupado} onClick={() => void copia()}>Exportar todos los datos</button></div>
      </div>
      {error && <p className="aviso" role="alert">{error}</p>}
    </div>
  );
}
