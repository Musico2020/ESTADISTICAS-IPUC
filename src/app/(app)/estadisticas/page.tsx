"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Calendar,
  Home,
  Users,
  Smile,
  Sparkles,
  Award,
  Layers,
  AlertTriangle,
  FileSpreadsheet,
  TrendingUp,
} from "lucide-react";
import SelectorPeriodo, { type Periodo } from "@/components/SelectorPeriodo";
import { filasPorZona, type Estadisticas } from "@/lib/informes/resumen";
import { periodoDeAnio } from "@/lib/mapa/periodo";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { ETIQUETA_CASO, ETIQUETA_DIFICULTAD, type Dificultad, type TipoCaso, type Zona } from "@/lib/tipos";

export default function PaginaEstadisticas() {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDeAnio(new Date().getFullYear()));
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zona, setZona] = useState("");
  const [e, setE] = useState<Estadisticas | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void crearClienteNavegador()
      .from("zonas")
      .select("*")
      .order("numero")
      .then(({ data }) => setZonas((data ?? []) as Zona[]));
  }, []);

  useEffect(() => {
    void crearClienteNavegador()
      .rpc("estadisticas", { p_desde: periodo.desde, p_hasta: periodo.hasta, p_zona: zona || null })
      .then(({ data, error: fallo }) => {
        setError(!!fallo);
        setE(data as Estadisticas | null);
      });
  }, [periodo, zona]);

  return (
    <div className="pila">
      {/* Encabezado */}
      <div>
        <h1>
          <BarChart3 size={28} style={{ color: "var(--marca)" }} />
          <span>Tablero de Métricas y Estadísticas</span>
        </h1>
        <p className="tenue">
          Consolidado general de impacto, cobertura territorial y resultados espirituales
        </p>
      </div>

      {/* Controles de Filtro */}
      <div className="tarjeta" style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <SelectorPeriodo alCambiar={setPeriodo} />
          <div className="campo" style={{ minWidth: 160 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--tenue)" }}>
              <Layers size={14} /> Filtrar por Zona
            </span>
            <select
              value={zona}
              onChange={(ev) => setZona(ev.target.value)}
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
      </div>

      {error && (
        <div className="aviso" role="alert" style={{ background: "var(--peligro-fondo)", borderColor: "var(--peligro-borde)", color: "var(--peligro-texto)" }}>
          <AlertTriangle size={18} />
          <span>No se pudieron cargar las estadísticas. Verifique la conexión a internet.</span>
        </div>
      )}

      {e && <Contenido e={e} />}
    </div>
  );
}

function Contenido({ e }: { e: Estadisticas }) {
  const t = e.totales;
  if (t.jornadas === 0) {
    return (
      <div className="tarjeta" style={{ textAlign: "center", padding: "48px 24px" }}>
        <FileSpreadsheet size={36} style={{ color: "var(--tenue)", margin: "0 auto 12px" }} />
        <h2 style={{ fontSize: "1.1rem", justifyContent: "center", marginBottom: 6 }}>
          No hay reportes registrados
        </h2>
        <p className="tenue">
          No se encontraron datos para el período o la zona seleccionada.
        </p>
      </div>
    );
  }

  const porZona = e.por_zona.map((z) => ({ nombre: z.nombre, alcanzadas: z.manzanas_alcanzadas }));

  return (
    <>
      {t.pendientes_marcar > 0 && (
        <div className="aviso">
          <AlertTriangle size={20} />
          <span>
            <b>{t.pendientes_marcar} reportes importados</b> aún no tienen manzanas marcadas y no se reflejan en el mapa cartográfico.
          </span>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="rejilla-kpi">
        <Kpi valor={t.jornadas} texto="Jornadas realizadas" subtitulo="Salidas evangelísticas" icono={<Calendar size={18} />} />
        <Kpi valor={t.hogares} texto="Hogares visitados" subtitulo="Familias contactadas" icono={<Home size={18} />} />
        <Kpi valor={t.personas} texto="Personas alcanzadas" subtitulo="Contactadas directamente" icono={<Users size={18} />} />
        <Kpi valor={t.visitas} texto="Aceptaron visita" subtitulo="Puertas abiertas" icono={<Smile size={18} />} />
        <Kpi valor={t.ninos} texto="Niños alcanzados" subtitulo="Evangelismo infantil" icono={<Sparkles size={18} />} />
        <Kpi valor={t.receptividad ? `${t.receptividad}/5` : "-"} texto="Receptividad" subtitulo="Promedio general" icono={<Award size={18} />} />
      </div>

      {/* GRÁFICAS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", gap: 18 }}>
        <Grafica titulo="Jornadas por mes" icono={<TrendingUp size={18} />} datos={e.por_mes} x="mes" y="jornadas" etiqueta="Jornadas" />
        <Grafica titulo="Manzanas alcanzadas por zona" icono={<Layers size={18} />} datos={porZona} x="nombre" y="alcanzadas" etiqueta="Manzanas" />
      </div>

      {/* TABLAS */}
      <div className="pila" style={{ gap: 18 }}>
        <Tabla titulo="Avance por zona territorial" icono={<Layers size={18} />} encabezados={["Zona", "Jornadas", "Personas", "Alcanzadas", "Total", "Avance"]} filas={filasPorZona(e)} />
        <Tabla titulo="Desglose mensual de actividad" icono={<Calendar size={18} />} encabezados={["Mes", "Jornadas", "Personas", "Hogares"]} filas={e.por_mes.map((m) => [m.mes, m.jornadas, m.personas, m.hogares])} />
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))", gap: 18 }}>
          <Tabla titulo="Dificultades en campo" icono={<AlertTriangle size={18} />} encabezados={["Dificultad", "Veces"]} filas={e.dificultades.map((d) => [ETIQUETA_DIFICULTAD[d.dificultad as Dificultad] ?? d.dificultad, d.cantidad])} />
          <Tabla titulo="Casos especiales detectados" icono={<Smile size={18} />} encabezados={["Tipo", "Total", "Pendientes"]} filas={e.casos.map((c) => [ETIQUETA_CASO[c.tipo as TipoCaso] ?? c.tipo, c.cantidad, c.pendientes])} />
        </div>
      </div>
    </>
  );
}

function Kpi({
  valor,
  texto,
  subtitulo,
  icono,
}: {
  valor: number | string;
  texto: string;
  subtitulo?: string;
  icono?: ReactNode;
}) {
  return (
    <div className="kpi">
      <div className="kpi-encabezado">
        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{texto}</span>
        {icono && <div className="kpi-icono">{icono}</div>}
      </div>
      <b>{valor}</b>
      {subtitulo && <span className="tenue">{subtitulo}</span>}
    </div>
  );
}

function Grafica({
  titulo,
  icono,
  datos,
  x,
  y,
  etiqueta,
}: {
  titulo: string;
  icono?: ReactNode;
  datos: object[];
  x: string;
  y: string;
  etiqueta: string;
}) {
  return (
    <section className="tarjeta">
      <h2 style={{ marginBottom: 14 }}>
        {icono}
        <span>{titulo}</span>
      </h2>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={datos} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--linea)" strokeDasharray="3 3" />
            <XAxis dataKey={x} tick={{ fill: "var(--tenue)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--linea)" }} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--tenue)", fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "var(--linea)", fillOpacity: 0.3 }}
              contentStyle={{
                background: "var(--superficie-pura)",
                border: "1px solid var(--linea)",
                borderRadius: 10,
                color: "var(--texto)",
                boxShadow: "var(--sombra-md)",
                fontSize: 13,
              }}
            />
            <Bar dataKey={y} name={etiqueta} fill="var(--grafica)" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Tabla({
  titulo,
  icono,
  encabezados,
  filas,
}: {
  titulo: string;
  icono?: ReactNode;
  encabezados: string[];
  filas: (string | number)[][] | { toString(): string }[][];
}) {
  if (filas.length === 0) return null;
  return (
    <section className="tarjeta pila" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px 10px" }}>
        <h2>
          {icono}
          <span>{titulo}</span>
        </h2>
      </div>
      <div className="tabla-envoltura" style={{ border: "none", boxShadow: "none", borderRadius: 0 }}>
        <table>
          <thead>
            <tr>
              {encabezados.map((h, i) => (
                <th key={h} className={i ? "numero" : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, idx) => (
              <tr key={idx}>
                {f.map((v, i) => (
                  <td key={i} className={i ? "numero" : undefined} style={{ fontWeight: i === 0 ? 600 : undefined }}>
                    {String(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
