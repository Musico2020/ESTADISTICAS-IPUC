"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardList,
  PlusCircle,
  Filter,
  Calendar,
  Layers,
  User,
  Users,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Inbox,
} from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Zona } from "@/lib/tipos";

const TAMANO = 20;
type Fila = {
  id: string;
  fecha_jornada: string;
  responsable_nombre: string;
  personas_contactadas: number | null;
  manzanas_pendientes: boolean;
  zonas: { nombre: string } | null;
};

export default function PaginaReportes() {
  return (
    <Suspense fallback={<p className="tenue">Cargando reportes...</p>}>
      <ListaReportes />
    </Suspense>
  );
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
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    void crearClienteNavegador()
      .from("zonas")
      .select("*")
      .order("numero")
      .then(({ data }) => setZonas((data ?? []) as Zona[]));
  }, []);

  useEffect(() => {
    setCargando(true);
    let consulta = crearClienteNavegador()
      .from("reportes")
      .select("id,fecha_jornada,responsable_nombre,personas_contactadas,manzanas_pendientes,zonas(nombre)", { count: "exact" })
      .order("fecha_jornada", { ascending: false })
      .range(pagina * TAMANO, pagina * TAMANO + TAMANO - 1);

    if (zona) consulta = consulta.eq("zona_id", zona);
    if (desde) consulta = consulta.gte("fecha_jornada", desde);
    if (hasta) consulta = consulta.lte("fecha_jornada", hasta);
    if (pendientes) consulta = consulta.eq("manzanas_pendientes", true);

    void consulta.then(({ data, count, error: fallo }) => {
      setCargando(false);
      setError(!!fallo);
      setFilas((data ?? []) as unknown as Fila[]);
      setTotal(count ?? 0);
    });
  }, [zona, desde, hasta, pendientes, pagina]);

  const filtrar = <T,>(f: (v: T) => void) => (v: T) => {
    setPagina(0);
    f(v);
  };

  const limpiarFiltros = () => {
    setZona("");
    setDesde("");
    setHasta("");
    setPendientes(false);
    setPagina(0);
  };

  const totalPaginas = Math.ceil(total / TAMANO);

  return (
    <div className="pila">
      {/* Encabezado */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div>
          <h1>
            <ClipboardList size={28} style={{ color: "var(--marca)" }} />
            <span>Bitácora de Reportes</span>
          </h1>
          <p className="tenue">
            Historial de jornadas y actividades evangelísticas registradas
          </p>
        </div>
        <Link href="/nuevo-reporte" className="boton">
          <PlusCircle size={18} />
          <span>Nuevo reporte</span>
        </Link>
      </div>

      {/* Barra de Filtros */}
      <div className="tarjeta pila" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--tenue)", display: "flex", alignItems: "center", gap: 6 }}>
            <Filter size={15} /> Filtros de búsqueda
          </span>
          {(zona || desde || hasta || pendientes) && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="boton secundario"
              style={{ minHeight: 32, padding: "4px 10px", fontSize: "0.8rem" }}
            >
              <RotateCcw size={13} />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div className="campo">
            <span><Layers size={14} /> Zona</span>
            <select value={zona} onChange={(e) => filtrar(setZona)(e.target.value)}>
              <option value="">Todas las zonas</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <span><Calendar size={14} /> Desde</span>
            <input type="date" value={desde} onChange={(e) => filtrar(setDesde)(e.target.value)} />
          </div>

          <div className="campo">
            <span><Calendar size={14} /> Hasta</span>
            <input type="date" value={hasta} onChange={(e) => filtrar(setHasta)(e.target.value)} />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <label className={`casilla ${pendientes ? "casilla-activa" : ""}`} style={{ width: "100%", margin: 0 }}>
              <input
                type="checkbox"
                checked={pendientes}
                onChange={(e) => filtrar(setPendientes)(e.target.checked)}
              />
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Solo pendientes de marcar</span>
            </label>
          </div>
        </div>
      </div>

      {/* Resultados */}
      {error && (
        <div className="aviso" role="alert">
          <AlertTriangle size={18} />
          <span>No se pudieron cargar los reportes. Intente recargar la página.</span>
        </div>
      )}

      {!cargando && filas.length === 0 && !error && (
        <div className="tarjeta" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--superficie-tenue)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tenue)" }}>
            <Inbox size={28} />
          </div>
          <h2 style={{ fontSize: "1.1rem", justifyContent: "center", marginBottom: 6 }}>
            No se encontraron reportes
          </h2>
          <p className="tenue" style={{ maxWidth: 400, margin: "0 auto 18px" }}>
            No hay registros que coincidan con los filtros seleccionados o aún no se han creado reportes en este período.
          </p>
          <Link href="/nuevo-reporte" className="boton">
            <PlusCircle size={16} />
            <span>Crear primer reporte</span>
          </Link>
        </div>
      )}

      {filas.length > 0 && (
        <div className="pila">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
            <span className="tenue" style={{ fontSize: "0.85rem" }}>
              Mostrando <b>{filas.length}</b> de <b>{total}</b> reportes
            </span>
          </div>

          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Fecha de jornada</th>
                  <th>Zona asignada</th>
                  <th>Responsable</th>
                  <th className="numero">Personas</th>
                  <th>Estado cartográfico</th>
                  <th style={{ textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={15} style={{ color: "var(--tenue)" }} />
                        <span style={{ fontWeight: 600 }}>{f.fecha_jornada}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-marca">
                        {f.zonas?.nombre ?? "Sin zona"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--superficie-tenue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "var(--texto-secundario)" }}>
                          <User size={14} />
                        </div>
                        <span>{f.responsable_nombre}</span>
                      </div>
                    </td>
                    <td className="numero">
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                        <Users size={14} style={{ color: "var(--tenue)" }} />
                        <span>{f.personas_contactadas ?? "-"}</span>
                      </div>
                    </td>
                    <td>
                      {f.manzanas_pendientes ? (
                        <span className="badge badge-aviso">
                          <span className="punto-estado punto-aviso" />
                          <span>Falta marcar manzanas</span>
                        </span>
                      ) : (
                        <span className="badge badge-exito">
                          <span className="punto-estado punto-exito" />
                          <span>Completo</span>
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/reportes/${f.id}`}
                        className="boton secundario"
                        style={{ minHeight: 34, padding: "4px 12px", fontSize: "0.82rem" }}
                      >
                        <span>Ver</span>
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8 }}>
              <button
                type="button"
                className="boton secundario"
                disabled={pagina === 0}
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={16} />
                <span>Anterior</span>
              </button>
              <span className="tenue" style={{ fontSize: "0.85rem" }}>
                Página <b>{pagina + 1}</b> de <b>{totalPaginas}</b>
              </span>
              <button
                type="button"
                className="boton secundario"
                disabled={pagina + 1 >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                <span>Siguiente</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
