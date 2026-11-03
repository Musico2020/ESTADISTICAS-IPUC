"use client";
import { useCallback, useEffect, useState } from "react";
import { MapPin, RefreshCw, Layers, CheckCircle2, AlertCircle } from "lucide-react";
import MapaDinamico from "@/components/MapaDinamico";
import SelectorPeriodo, { type Periodo } from "@/components/SelectorPeriodo";
import { calcularAvance, COLOR_ALCANZADA, COLOR_SIN_PREDICAR } from "@/lib/mapa/avance";
import { periodoDeAnio } from "@/lib/mapa/periodo";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { EstadoManzana, Manzana, Zona } from "@/lib/tipos";

export default function PaginaMapa() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [manzanas, setManzanas] = useState<Manzana[]>([]);
  const [estados, setEstados] = useState<EstadoManzana[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDeAnio(new Date().getFullYear()));
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setError(false);
    setCargando(true);
    const db = crearClienteNavegador();
    const [z, m, e] = await Promise.all([
      db.from("zonas").select("*").order("numero"),
      db.from("manzanas").select("*").order("codigo"),
      db.rpc("estado_manzanas", { p_desde: periodo.desde, p_hasta: periodo.hasta }),
    ]);
    setCargando(false);
    if (z.error || m.error || e.error) {
      setError(true);
      return;
    }
    setZonas(z.data as Zona[]);
    setManzanas(m.data as Manzana[]);
    setEstados(e.data as EstadoManzana[]);
  }, [periodo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const total = calcularAvance(manzanas, estados);

  return (
    <div className="pila">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div>
          <h1>
            <MapPin size={28} style={{ color: "var(--marca)" }} />
            <span>Mapa de Evangelismo</span>
          </h1>
          <p className="tenue">
            Monitoreo territorial del avance evangelístico en el Barrio Dangond
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SelectorPeriodo alCambiar={setPeriodo} />
          <button
            type="button"
            className="boton secundario"
            onClick={() => void cargar()}
            disabled={cargando}
            title="Actualizar datos"
            style={{ padding: "8px 12px" }}
          >
            <RefreshCw size={16} className={cargando ? "girar" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="aviso fila" role="alert" style={{ background: "var(--peligro-fondo)", borderColor: "var(--peligro-borde)", color: "var(--peligro-texto)" }}>
          <AlertCircle size={20} />
          <span>No se pudo cargar el mapa territorial. Verifique la conexión a internet.</span>
          <button className="boton secundario" style={{ marginLeft: "auto" }} onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      )}

      {/* REJILLA DE AVANCE POR ZONA */}
      <div className="rejilla-kpi">
        <TarjetaAvance
          titulo="Total General"
          avance={total}
          esPrincipal
        />
        {zonas.map((z) => (
          <TarjetaAvance
            key={z.id}
            titulo={z.nombre}
            avance={calcularAvance(manzanas, estados, z.id)}
            color={z.color_borde}
          />
        ))}
      </div>

      {/* LEYENDA Y MAPA */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="leyenda">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i style={{ background: COLOR_ALCANZADA }} />
            <span style={{ fontWeight: 600 }}>Alcanzada</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i style={{ background: COLOR_SIN_PREDICAR }} />
            <span style={{ fontWeight: 600 }}>Sin predicar</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <Layers size={15} style={{ color: "var(--tenue)" }} />
            <span className="tenue">La línea exterior gruesa delimita cada zona / bloque</span>
          </div>
        </div>

        <MapaDinamico zonas={zonas} manzanas={manzanas} estados={estados} />
      </div>

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

function TarjetaAvance({
  titulo,
  avance,
  color,
  esPrincipal,
}: {
  titulo: string;
  avance: ReturnType<typeof calcularAvance>;
  color?: string;
  esPrincipal?: boolean;
}) {
  return (
    <div
      className="kpi"
      style={{
        borderTop: color ? `4px solid ${color}` : esPrincipal ? "4px solid var(--marca)" : undefined,
        background: esPrincipal ? "var(--superficie-pura)" : undefined,
      }}
    >
      <div className="kpi-encabezado">
        <span style={{ fontWeight: 700, fontSize: "0.92rem", color: color ?? "inherit" }}>
          {titulo}
        </span>
        <span
          className="badge"
          style={{
            background: esPrincipal ? "var(--marca-fondo)" : "var(--superficie-tenue)",
            color: esPrincipal ? "var(--marca)" : "var(--texto-secundario)",
          }}
        >
          {avance.alcanzadas}/{avance.total}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <b style={{ fontSize: "2rem", color: avance.porcentaje === 100 ? "var(--exito)" : undefined }}>
          {avance.porcentaje}%
        </b>
        {avance.porcentaje === 100 && (
          <CheckCircle2 size={18} style={{ color: "var(--exito)" }} />
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }} className="tenue">
          <span>{avance.alcanzadas} manzanas alcanzadas</span>
          <span>{avance.total - avance.alcanzadas} restantes</span>
        </div>
        <div className="barra">
          <i
            style={{
              width: `${avance.porcentaje}%`,
              background: avance.porcentaje === 100
                ? "linear-gradient(90deg, #10b981 0%, #059669 100%)"
                : color
                ? color
                : undefined,
            }}
          />
        </div>
      </div>
    </div>
  );
}
