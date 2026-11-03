"use client";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
    void crearClienteNavegador().from("zonas").select("*").order("numero").then(({ data }) => setZonas((data ?? []) as Zona[]));
  }, []);

  useEffect(() => {
    void crearClienteNavegador().rpc("estadisticas", { p_desde: periodo.desde, p_hasta: periodo.hasta, p_zona: zona || null })
      .then(({ data, error: fallo }) => { setError(!!fallo); setE(data as Estadisticas | null); });
  }, [periodo, zona]);

  return (
    <div className="pila">
      <h1>Estadísticas</h1>
      <div className="fila">
        <SelectorPeriodo alCambiar={setPeriodo} />
        <label className="campo"><span>Zona</span>
          <select value={zona} onChange={(ev) => setZona(ev.target.value)}>
            <option value="">Todas</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="aviso" role="alert">No se pudieron cargar las estadísticas.</p>}
      {e && <Contenido e={e} />}
    </div>
  );
}

function Contenido({ e }: { e: Estadisticas }) {
  const t = e.totales;
  if (t.jornadas === 0) return <p className="tenue">No hay reportes en este período.</p>;
  const porZona = e.por_zona.map((z) => ({ nombre: z.nombre, alcanzadas: z.manzanas_alcanzadas }));
  return (
    <>
      {t.pendientes_marcar > 0 && (
        <p className="aviso">{t.pendientes_marcar} reportes importados aún no tienen manzanas marcadas y no aparecen en el mapa.</p>
      )}
      <div className="rejilla-kpi">
        <Kpi valor={t.jornadas} texto="Jornadas" />
        <Kpi valor={t.hogares} texto="Hogares visitados" />
        <Kpi valor={t.personas} texto="Personas contactadas" />
        <Kpi valor={t.visitas} texto="Aceptaron visita" />
        <Kpi valor={t.ninos} texto="Niños alcanzados" />
        <Kpi valor={t.receptividad ?? "-"} texto="Receptividad promedio (1 a 5)" />
      </div>
      <Grafica titulo="Jornadas por mes" datos={e.por_mes} x="mes" y="jornadas" etiqueta="Jornadas" />
      <Grafica titulo="Manzanas alcanzadas por zona" datos={porZona} x="nombre" y="alcanzadas" etiqueta="Manzanas alcanzadas" />
      <Tabla titulo="Avance por zona" encabezados={["Zona", "Jornadas", "Personas", "Alcanzadas", "Total", "Avance"]} filas={filasPorZona(e)} />
      <Tabla titulo="Por mes" encabezados={["Mes", "Jornadas", "Personas", "Hogares"]} filas={e.por_mes.map((m) => [m.mes, m.jornadas, m.personas, m.hogares])} />
      <Tabla titulo="Dificultades" encabezados={["Dificultad", "Veces"]}
        filas={e.dificultades.map((d) => [ETIQUETA_DIFICULTAD[d.dificultad as Dificultad] ?? d.dificultad, d.cantidad])} />
      <Tabla titulo="Casos especiales" encabezados={["Tipo", "Total", "Pendientes"]}
        filas={e.casos.map((c) => [ETIQUETA_CASO[c.tipo as TipoCaso] ?? c.tipo, c.cantidad, c.pendientes])} />
    </>
  );
}

function Kpi({ valor, texto }: { valor: number | string; texto: string }) {
  return <div className="kpi"><b>{valor}</b><span>{texto}</span></div>;
}

function Grafica({ titulo, datos, x, y, etiqueta }: { titulo: string; datos: object[]; x: string; y: string; etiqueta: string }) {
  return (
    <section className="tarjeta">
      <h2>{titulo}</h2>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={datos} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--linea)" />
            <XAxis dataKey={x} tick={{ fill: "var(--tenue)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--linea)" }} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--tenue)", fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: "var(--linea)", fillOpacity: 0.4 }}
              contentStyle={{ background: "var(--superficie)", border: "1px solid var(--linea)", borderRadius: 8, color: "var(--texto)" }} />
            <Bar dataKey={y} name={etiqueta} fill="var(--grafica)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Tabla({ titulo, encabezados, filas }: { titulo: string; encabezados: string[]; filas: (string | number)[][] }) {
  if (filas.length === 0) return null;
  return (
    <section className="tarjeta tabla-envoltura">
      <h2>{titulo}</h2>
      <table>
        <thead><tr>{encabezados.map((h, i) => <th key={h} className={i ? "numero" : undefined}>{h}</th>)}</tr></thead>
        <tbody>{filas.map((f) => <tr key={String(f[0])}>{f.map((v, i) => <td key={i} className={i ? "numero" : undefined}>{v}</td>)}</tr>)}</tbody>
      </table>
    </section>
  );
}
