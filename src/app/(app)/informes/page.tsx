"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Database,
  Layers,
  ShieldAlert,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
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
    if (!esAdmin) {
      router.replace("/mapa");
      return;
    }
    void crearClienteNavegador()
      .from("zonas")
      .select("*")
      .order("numero")
      .then(({ data }) => setZonas((data ?? []) as Zona[]));
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
  const datos = () =>
    cargarDatosInforme(crearClienteNavegador(), { ...periodo, zona, zonaNombre, incluirCasos });

  const pdf = () =>
    ejecutar(async () => {
      const [{ generarPdf }, d] = await Promise.all([import("@/lib/informes/pdf"), datos()]);
      await generarPdf(d);
    });

  const excel = () =>
    ejecutar(async () => {
      const [{ generarExcel }, d] = await Promise.all([import("@/lib/informes/excel"), datos()]);
      await generarExcel(d);
    });

  const copia = () =>
    ejecutar(async () => {
      const [{ generarExcel }, d] = await Promise.all([
        import("@/lib/informes/excel"),
        cargarDatosInforme(crearClienteNavegador(), {
          desde: "2000-01-01",
          hasta: "2100-12-31",
          zona: "",
          zonaNombre: "Todas",
          incluirCasos: true,
        }),
      ]);
      await generarExcel(d);
    });

  return (
    <div className="pila">
      {/* Encabezado */}
      <div>
        <h1>
          <FileSpreadsheet size={28} style={{ color: "var(--marca)" }} />
          <span>Generación de Informes y Exportaciones</span>
        </h1>
        <p className="tenue">
          Descargue reportes formales en formato PDF para reuniones directivas o matrices completas en Excel
        </p>
      </div>

      {/* Filtros de exportación */}
      <div className="tarjeta pila">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <SelectorPeriodo alCambiar={setPeriodo} />
          <div className="campo" style={{ minWidth: 180 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--tenue)" }}>
              <Layers size={14} /> Filtrar por Zona
            </span>
            <select
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              style={{ minHeight: 40, padding: "6px 12px" }}
            >
              <option value="">Todas las zonas</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className={`casilla ${incluirCasos ? "casilla-activa" : ""}`}>
          <input
            type="checkbox"
            checked={incluirCasos}
            onChange={(e) => setIncluirCasos(e.target.checked)}
          />
          <div>
            <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldAlert size={16} style={{ color: "var(--aviso)" }} />
              Incluir detalles de casos especiales en la exportación
            </span>
            <span className="tenue" style={{ fontSize: "0.82rem" }}>
              Precaución: contiene información sensible de personas enfermas, consejería y nombres de contacto.
            </span>
          </div>
        </label>
      </div>

      {/* Opciones de Descarga */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        {/* PDF Card */}
        <div className="tarjeta" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--peligro-fondo)", color: "var(--peligro)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <FileText size={24} />
            </div>
            <h2 style={{ fontSize: "1.15rem", marginBottom: 6 }}>Informe Oficial PDF</h2>
            <p className="tenue" style={{ fontSize: "0.9rem", lineHeight: 1.5, marginBottom: 16 }}>
              Documento formateado con tablas consolidadas, estadísticas generales y diseño listo para imprimir o enviar a la junta directiva.
            </p>
          </div>
          <button className="boton" disabled={ocupado} onClick={() => void pdf()} style={{ width: "100%" }}>
            {ocupado ? (
              <>
                <Loader2 size={18} className="girar" />
                <span>Generando PDF...</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Descargar Informe PDF</span>
              </>
            )}
          </button>
        </div>

        {/* Excel Card */}
        <div className="tarjeta" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--exito-fondo)", color: "var(--exito)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <FileSpreadsheet size={24} />
            </div>
            <h2 style={{ fontSize: "1.15rem", marginBottom: 6 }}>Planilla de Cálculo Excel</h2>
            <p className="tenue" style={{ fontSize: "0.9rem", lineHeight: 1.5, marginBottom: 16 }}>
              Libro de Excel (.xlsx) con pestañas independientes para resumen de métricas, detalle de jornadas y lista de casos especiales.
            </p>
          </div>
          <button className="boton" disabled={ocupado} onClick={() => void excel()} style={{ width: "100%", background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
            {ocupado ? (
              <>
                <Loader2 size={18} className="girar" />
                <span>Generando Excel...</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Descargar Libro Excel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Copia de Seguridad */}
      <div className="tarjeta pila" style={{ borderLeft: "4px solid var(--marca)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--marca-fondo)", color: "var(--marca)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Database size={22} />
          </div>
          <div>
            <h2>Copia de seguridad general del sistema</h2>
            <p className="tenue" style={{ marginTop: 4, lineHeight: 1.5 }}>
              Exporta un respaldo completo e íntegro de todos los años históricos (reportes, manzanas y casos). Recomendado descargar al cierre de cada mes eclesiástico.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="boton secundario" disabled={ocupado} onClick={() => void copia()}>
            <Database size={16} />
            <span>Exportar copia histórica completa (.xlsx)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="aviso" role="alert" style={{ background: "var(--peligro-fondo)", borderColor: "var(--peligro-borde)", color: "var(--peligro-texto)" }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <style jsx>{`
        .girar {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
