"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Zona } from "@/lib/tipos";

const TAMANO = 20;
type Fila = { id: string; fecha_jornada: string; responsable_nombre: string; personas_contactadas: number | null; manzanas_pendientes: boolean; zonas: { nombre: string } | null };

export default function PaginaReportes() {
  return <Suspense><ListaReportes /></Suspense>;
}

function ListaReportes() {
  const parametros = useSearchParams();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zona, setZona] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pendientes, setPendientes] = useState(parametros.get("pendientes") === "1");
  const [pagina, setPagina] = useState(0);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    void crearClienteNavegador().from("zonas").select("*").order("numero").then(({ data }) => setZonas((data ?? []) as Zona[]));
  }, []);

  useEffect(() => {
    let consulta = crearClienteNavegador().from("reportes")
      .select("id,fecha_jornada,responsable_nombre,personas_contactadas,manzanas_pendientes,zonas(nombre)", { count: "exact" })
      .order("fecha_jornada", { ascending: false })
      .range(pagina * TAMANO, pagina * TAMANO + TAMANO - 1);
    if (zona) consulta = consulta.eq("zona_id", zona);
    if (desde) consulta = consulta.gte("fecha_jornada", desde);
    if (hasta) consulta = consulta.lte("fecha_jornada", hasta);
    if (pendientes) consulta = consulta.eq("manzanas_pendientes", true);
    void consulta.then(({ data, count, error: fallo }) => {
      setError(!!fallo);
      setFilas((data ?? []) as unknown as Fila[]);
      setTotal(count ?? 0);
    });
  }, [zona, desde, hasta, pendientes, pagina]);

  const filtrar = <T,>(f: (v: T) => void) => (v: T) => { setPagina(0); f(v); };

  return (
    <div className="pila">
      <h1>Reportes</h1>
      <div className="fila tarjeta">
        <label className="campo"><span>Zona</span>
          <select value={zona} onChange={(e) => filtrar(setZona)(e.target.value)}>
            <option value="">Todas</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
        <label className="campo"><span>Desde</span><input type="date" value={desde} onChange={(e) => filtrar(setDesde)(e.target.value)} /></label>
        <label className="campo"><span>Hasta</span><input type="date" value={hasta} onChange={(e) => filtrar(setHasta)(e.target.value)} /></label>
        <label className="casilla"><input type="checkbox" checked={pendientes} onChange={(e) => filtrar(setPendientes)(e.target.checked)} />Pendientes de marcar manzanas</label>
      </div>
      {error && <p className="aviso" role="alert">No se pudieron cargar los reportes.</p>}
      {!error && filas.length === 0 && <p className="tenue">No hay reportes con estos filtros.</p>}
      {filas.length > 0 && (
        <div className="tarjeta tabla-envoltura">
          <table>
            <thead><tr><th>Fecha</th><th>Zona</th><th>Responsable</th><th className="numero">Personas</th><th>Estado</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td><Link href={`/reportes/${f.id}`}>{f.fecha_jornada}</Link></td>
                  <td>{f.zonas?.nombre}</td>
                  <td>{f.responsable_nombre}</td>
                  <td className="numero">{f.personas_contactadas ?? "-"}</td>
                  <td>{f.manzanas_pendientes ? "Falta marcar manzanas" : "Completo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="fila">
        <button className="boton secundario" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span className="tenue">{total} reportes</span>
        <button className="boton secundario" disabled={(pagina + 1) * TAMANO >= total} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
      </div>
    </div>
  );
}
