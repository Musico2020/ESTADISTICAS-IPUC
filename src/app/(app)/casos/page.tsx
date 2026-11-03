"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  HeartPulse,
  Filter,
  Layers,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Inbox,
  AlertCircle,
  Eye,
  LifeBuoy,
} from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { ETIQUETA_CASO, type TipoCaso, type Zona } from "@/lib/tipos";

type Caso = {
  id: string;
  reporte_id: string;
  tipo: TipoCaso;
  descripcion: string;
  estado: "pendiente" | "atendido";
  zonas: { nombre: string } | null;
  reportes: { fecha_jornada: string } | null;
};

export default function PaginaCasos() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zona, setZona] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [casos, setCasos] = useState<Caso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    let c = crearClienteNavegador()
      .from("casos_especiales")
      .select("id,reporte_id,tipo,descripcion,estado,zonas(nombre),reportes(fecha_jornada)")
      .order("id", { ascending: false })
      .limit(200);

    if (zona) c = c.eq("zona_id", zona);
    if (tipo) c = c.eq("tipo", tipo);
    if (estado) c = c.eq("estado", estado);

    const { data, error: fallo } = await c;
    setCargando(false);
    setError(fallo ? "No se pudieron cargar los casos." : "");
    setCasos((data ?? []) as unknown as Caso[]);
  }, [zona, tipo, estado]);

  useEffect(() => {
    void crearClienteNavegador()
      .from("zonas")
      .select("*")
      .order("numero")
      .then(({ data }) => setZonas((data ?? []) as Zona[]));
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cambiar(c: Caso) {
    const atendido = c.estado === "pendiente";
    const { error: fallo } = await crearClienteNavegador()
      .from("casos_especiales")
      .update({
        estado: atendido ? "atendido" : "pendiente",
        atendido_en: atendido ? new Date().toISOString() : null,
      })
      .eq("id", c.id);
    if (fallo) {
      setError("No se pudo actualizar el estado del caso.");
      return;
    }
    void cargar();
  }

  const obtenerIconoTipo = (t: TipoCaso) => {
    switch (t) {
      case "enfermo":
        return <HeartPulse size={18} style={{ color: "var(--peligro)" }} />;
      case "sordo":
        return <Eye size={18} style={{ color: "var(--marca)" }} />;
      case "consejeria":
        return <LifeBuoy size={18} style={{ color: "#d97706" }} />;
      default:
        return <HeartPulse size={18} />;
    }
  };

  return (
    <div className="pila">
      {/* Encabezado */}
      <div>
        <h1>
          <HeartPulse size={28} style={{ color: "var(--peligro)" }} />
          <span>Casos Especiales y Seguimiento Pastoral</span>
        </h1>
        <p className="tenue">
          Personas enfermas, sordas o con necesidad de visitación y consejería especial detectadas en el campo
        </p>
      </div>

      {/* Filtros */}
      <div className="tarjeta pila" style={{ padding: 18 }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--tenue)", display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={15} /> Filtrar casos
        </span>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div className="campo">
            <span><Layers size={14} /> Zona</span>
            <select value={zona} onChange={(e) => setZona(e.target.value)}>
              <option value="">Todas las zonas</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <span><HeartPulse size={14} /> Tipo de caso</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              {Object.entries(ETIQUETA_CASO).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <span><Clock size={14} /> Estado</span>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Solo Pendientes</option>
              <option value="atendido">Solo Atendidos</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="aviso" role="alert" style={{ background: "var(--peligro-fondo)", borderColor: "var(--peligro-borde)", color: "var(--peligro-texto)" }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de Casos */}
      {!cargando && casos.length === 0 && !error && (
        <div className="tarjeta" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--superficie-tenue)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tenue)" }}>
            <Inbox size={28} />
          </div>
          <h2 style={{ fontSize: "1.1rem", justifyContent: "center", marginBottom: 6 }}>
            No hay casos en este momento
          </h2>
          <p className="tenue" style={{ maxWidth: 420, margin: "0 auto" }}>
            {estado === "pendiente"
              ? "¡Excelente noticia! No hay casos especiales pendientes con estos filtros."
              : "No se encontraron casos con los criterios de búsqueda aplicados."}
          </p>
        </div>
      )}

      {casos.length > 0 && (
        <div className="pila" style={{ gap: 14 }}>
          <span className="tenue" style={{ fontSize: "0.85rem" }}>
            Total casos encontrados: <b>{casos.length}</b>
          </span>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            {casos.map((c) => (
              <div
                key={c.id}
                className="tarjeta"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderLeft: `4px solid ${c.estado === "pendiente" ? "var(--aviso)" : "var(--exito)"}`,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--superficie-tenue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {obtenerIconoTipo(c.tipo)}
                      </div>
                      <div>
                        <b style={{ fontSize: "1rem", display: "block" }}>
                          {ETIQUETA_CASO[c.tipo] ?? c.tipo}
                        </b>
                        <span className="badge badge-marca" style={{ fontSize: "0.74rem", marginTop: 2 }}>
                          {c.zonas?.nombre ?? "Zona sin asignar"}
                        </span>
                      </div>
                    </div>

                    <span className={`badge ${c.estado === "pendiente" ? "badge-aviso" : "badge-exito"}`}>
                      <span className={`punto-estado ${c.estado === "pendiente" ? "punto-aviso" : "punto-exito"}`} />
                      <span>{c.estado === "pendiente" ? "Pendiente" : "Atendido"}</span>
                    </span>
                  </div>

                  <p style={{ fontSize: "0.92rem", lineHeight: 1.55, marginBottom: 14, color: "var(--texto)" }}>
                    {c.descripcion || "Sin descripción detallada proporcionada en el reporte."}
                  </p>
                </div>

                <div style={{ paddingTop: 12, borderTop: "1px solid var(--linea)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <Link
                    href={`/reportes/${c.reporte_id}`}
                    style={{ fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Calendar size={13} />
                    <span>Jornada: {c.reportes?.fecha_jornada ?? "Ver"}</span>
                    <ArrowRight size={13} />
                  </Link>

                  <button
                    type="button"
                    className={`boton ${c.estado === "pendiente" ? "" : "secundario"}`}
                    style={{ minHeight: 34, padding: "4px 12px", fontSize: "0.82rem" }}
                    onClick={() => void cambiar(c)}
                  >
                    {c.estado === "pendiente" ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Marcar atendido</span>
                      </>
                    ) : (
                      <>
                        <Clock size={14} />
                        <span>Reabrir caso</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
