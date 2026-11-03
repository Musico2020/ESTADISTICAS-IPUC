"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { usePerfil } from "@/components/ContextoPerfil";
import { traducirFila, type ResultadoFila } from "@/lib/importar/leer";
import { crearClienteNavegador } from "@/lib/supabase/cliente";

const LOTE = 200;
type Fila = Record<string, unknown>;
type Traducida = ResultadoFila & { numero: number };

async function leerArchivo(archivo: File): Promise<Fila[]> {
  if (archivo.name.toLowerCase().endsWith(".csv")) {
    const Papa = (await import("papaparse")).default;
    return new Promise((resolver, rechazar) => {
      Papa.parse<Fila>(archivo, {
        header: true,
        skipEmptyLines: true,
        complete: (r) => resolver(r.data),
        error: rechazar,
      });
    });
  }
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  const hoja = libro.worksheets[0];
  const encabezados: string[] = [];
  hoja.getRow(1).eachCell((c, n) => {
    encabezados[n] = c.text;
  });
  const filas: Fila[] = [];
  hoja.eachRow((fila, n) => {
    if (n === 1) return;
    const f: Fila = {};
    encabezados.forEach((h, i) => {
      if (!h) return;
      const celda = fila.getCell(i);
      f[h] = celda.value instanceof Date ? celda.value : celda.text;
    });
    filas.push(f);
  });
  return filas;
}

export default function PaginaImportar() {
  const perfil = usePerfil();
  const router = useRouter();
  const esAdmin = perfil.rol === "administrador";
  const [filas, setFilas] = useState<Traducida[] | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!esAdmin) router.replace("/mapa");
  }, [esAdmin, router]);

  if (!esAdmin) return null;

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setNombreArchivo(archivo.name);
    setError("");
    setResultado("");
    setFilas(null);
    try {
      const { data: zonas, error: fallo } = await crearClienteNavegador().from("zonas").select("id,numero");
      if (fallo) throw fallo;
      const crudas = await leerArchivo(archivo);
      setFilas(
        await Promise.all(
          crudas.map(async (f, i) => ({
            ...(await traducirFila(f, zonas ?? [])),
            numero: i + 2,
          }))
        )
      );
    } catch {
      setError("No se pudo leer el archivo. Asegúrese de que sea un archivo válido .csv o .xlsx descargado de Google Forms.");
    }
  }

  const validas = (filas ?? []).filter((f): f is Extract<Traducida, { ok: true }> => f.ok);
  const rechazadas = (filas ?? []).filter((f): f is Extract<Traducida, { ok: false }> => !f.ok);
  const advertidas = validas.filter((f) => f.advertencias.length > 0);

  async function importar() {
    setOcupado(true);
    setError("");
    let nuevos = 0;
    try {
      for (let i = 0; i < validas.length; i += LOTE) {
        const lote = validas.slice(i, i + LOTE).map((f) => ({ reporte: f.reporte, casos: f.casos }));
        const { data, error: fallo } = await crearClienteNavegador().rpc("importar_reportes", { p_filas: lote });
        if (fallo) throw fallo;
        nuevos += data as number;
      }
      setResultado(`¡Proceso completado! Se importaron ${nuevos} reportes nuevos (${validas.length - nuevos} ya estaban registrados en el sistema).`);
    } catch {
      setError(`La importación se interrumpió tras ${nuevos} reportes procesados. Puede volver a subir el archivo con seguridad (los reportes ya ingresados no se duplicarán).`);
    }
    setOcupado(false);
  }

  return (
    <div className="pila">
      <div>
        <Link href="/administracion" className="boton secundario" style={{ minHeight: 36, padding: "4px 12px", fontSize: "0.82rem", marginBottom: 12, display: "inline-flex" }}>
          <ArrowLeft size={15} />
          <span>Volver al panel</span>
        </Link>
        <h1>
          <UploadCloud size={28} style={{ color: "var(--marca)" }} />
          <span>Importar Respuestas desde Google Forms</span>
        </h1>
        <p className="tenue">
          Migre rápidamente las respuestas de los formularios anteriores en formato Excel (.xlsx) o CSV
        </p>
      </div>

      {/* Selector de Archivo */}
      <div className="tarjeta pila">
        <label
          style={{
            border: "2px dashed var(--linea-fuerte)",
            borderRadius: "var(--radio-md)",
            padding: "36px 20px",
            textAlign: "center",
            cursor: "pointer",
            background: "var(--superficie-tenue)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--marca-fondo)", color: "var(--marca)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <b style={{ fontSize: "1.05rem", display: "block" }}>
              {nombreArchivo || "Seleccione o arrastre el archivo de Google Forms"}
            </b>
            <span className="tenue" style={{ fontSize: "0.85rem" }}>
              Formatos soportados: hojas de cálculo de Google Forms (.csv, .xlsx)
            </span>
          </div>
          <input
            type="file"
            accept=".csv,.xlsx"
            style={{ display: "none" }}
            onChange={(e) => void elegir(e.target.files?.[0])}
          />
          <span className="boton secundario" style={{ pointerEvents: "none", marginTop: 4 }}>
            Examinar archivo
          </span>
        </label>

        {error && (
          <div className="aviso" role="alert" style={{ background: "var(--peligro-fondo)", borderColor: "var(--peligro-borde)", color: "var(--peligro-texto)" }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Vista previa de análisis */}
      {filas && (
        <div className="tarjeta pila">
          <h2>
            <FileCheck size={22} style={{ color: "var(--marca)" }} />
            <span>Diagnóstico del archivo analizado</span>
          </h2>

          <div className="rejilla-kpi">
            <div className="kpi">
              <span className="tenue">Registros válidos</span>
              <b style={{ color: "var(--exito)" }}>{validas.length}</b>
              <span className="badge badge-exito">Listos para procesar</span>
            </div>
            <div className="kpi">
              <span className="tenue">Con observaciones</span>
              <b style={{ color: "var(--aviso)" }}>{advertidas.length}</b>
              <span className="badge badge-aviso">Correcciones menores</span>
            </div>
            <div className="kpi">
              <span className="tenue">Rechazados</span>
              <b style={{ color: "var(--peligro)" }}>{rechazadas.length}</b>
              <span className="badge badge-tenue">Sin zona o fecha</span>
            </div>
          </div>

          {rechazadas.length > 0 && (
            <div style={{ padding: 14, borderRadius: "var(--radio-sm)", background: "var(--peligro-fondo)", border: "1px solid var(--peligro-borde)" }}>
              <b style={{ color: "var(--peligro-texto)", fontSize: "0.9rem", display: "block", marginBottom: 6 }}>
                Filas con errores insalvables:
              </b>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
                {rechazadas.map((f) => (
                  <span key={f.numero} className="error" style={{ fontSize: "0.82rem" }}>
                    <XCircle size={14} /> Fila {f.numero}: {f.motivo}
                  </span>
                ))}
              </div>
            </div>
          )}

          {advertidas.length > 0 && (
            <div style={{ padding: 14, borderRadius: "var(--radio-sm)", background: "var(--aviso-fondo)", border: "1px solid var(--aviso-borde)" }}>
              <b style={{ color: "var(--aviso-texto)", fontSize: "0.9rem", display: "block", marginBottom: 6 }}>
                Observaciones automáticas atendidas:
              </b>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                {advertidas.slice(0, 10).map((f) => (
                  <span key={f.numero} className="tenue" style={{ fontSize: "0.82rem" }}>
                    Fila {f.numero}: {f.advertencias.join("; ")}
                  </span>
                ))}
                {advertidas.length > 10 && (
                  <span className="tenue" style={{ fontSize: "0.8rem", fontStyle: "italic" }}>
                    y {advertidas.length - 10} observaciones más...
                  </span>
                )}
              </div>
            </div>
          )}

          {!resultado && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="boton"
                disabled={ocupado || validas.length === 0}
                onClick={() => void importar()}
                style={{ minWidth: 200 }}
              >
                {ocupado ? (
                  <>
                    <Loader2 size={18} className="girar" />
                    <span>Importando filas...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Importar {validas.length} reportes válidos</span>
                  </>
                )}
              </button>
            </div>
          )}

          {resultado && (
            <div className="exito-box" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={20} />
                <b style={{ fontSize: "1rem" }}>{resultado}</b>
              </div>
              <Link href="/reportes?pendientes=1" className="boton" style={{ marginTop: 6, fontSize: "0.85rem", minHeight: 36 }}>
                Ir a marcar manzanas en los reportes importados
              </Link>
            </div>
          )}
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
