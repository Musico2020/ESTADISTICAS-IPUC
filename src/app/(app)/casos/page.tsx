"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { ETIQUETA_CASO, type TipoCaso, type Zona } from "@/lib/tipos";

type Caso = { id: string; reporte_id: string; tipo: TipoCaso; descripcion: string; estado: "pendiente" | "atendido"; zonas: { nombre: string } | null; reportes: { fecha_jornada: string } | null };

export default function PaginaCasos() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zona, setZona] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [casos, setCasos] = useState<Caso[]>([]);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    let c = crearClienteNavegador().from("casos_especiales")
      .select("id,reporte_id,tipo,descripcion,estado,zonas(nombre),reportes(fecha_jornada)")
      .order("id", { ascending: false }).limit(200);
    if (zona) c = c.eq("zona_id", zona);
    if (tipo) c = c.eq("tipo", tipo);
    if (estado) c = c.eq("estado", estado);
    const { data, error: fallo } = await c;
    setError(fallo ? "No se pudieron cargar los casos." : "");
    setCasos((data ?? []) as unknown as Caso[]);
  }, [zona, tipo, estado]);

  useEffect(() => {
    void crearClienteNavegador().from("zonas").select("*").order("numero").then(({ data }) => setZonas((data ?? []) as Zona[]));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar los filtros
    void cargar();
  }, [cargar]);

  async function cambiar(c: Caso) {
    const atendido = c.estado === "pendiente";
    const { error: fallo } = await crearClienteNavegador().from("casos_especiales")
      .update({ estado: atendido ? "atendido" : "pendiente", atendido_en: atendido ? new Date().toISOString() : null }).eq("id", c.id);
    if (fallo) { setError("No se pudo actualizar el caso."); return; }
    void cargar();
  }

  return (
    <div className="pila">
      <h1>Casos especiales</h1>
      <div className="fila tarjeta">
        <label className="campo"><span>Zona</span>
          <select value={zona} onChange={(e) => setZona(e.target.value)}>
            <option value="">Todas</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
        <label className="campo"><span>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ETIQUETA_CASO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="campo"><span>Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="atendido">Atendido</option>
          </select>
        </label>
      </div>
      {error && <p className="aviso" role="alert">{error}</p>}
      {!error && casos.length === 0 && <p className="tenue">No hay casos con estos filtros.</p>}
      {casos.map((c) => (
        <div key={c.id} className="tarjeta pila">
          <b>{ETIQUETA_CASO[c.tipo]}</b>
          <span className="tenue">{c.zonas?.nombre} · <Link href={`/reportes/${c.reporte_id}`}>Jornada del {c.reportes?.fecha_jornada}</Link> · {c.estado === "pendiente" ? "Pendiente" : "Atendido"}</span>
          <p style={{ margin: 0 }}>{c.descripcion || "Sin descripción"}</p>
          <div><button className="boton secundario" onClick={() => void cambiar(c)}>{c.estado === "pendiente" ? "Marcar atendido" : "Marcar pendiente"}</button></div>
        </div>
      ))}
    </div>
  );
}
