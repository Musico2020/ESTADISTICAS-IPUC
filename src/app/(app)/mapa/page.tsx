"use client";
import { useCallback, useEffect, useState } from "react";
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

  const cargar = useCallback(async () => {
    setError(false);
    const db = crearClienteNavegador();
    const [z, m, e] = await Promise.all([
      db.from("zonas").select("*").order("numero"),
      db.from("manzanas").select("*").order("codigo"),
      db.rpc("estado_manzanas", { p_desde: periodo.desde, p_hasta: periodo.hasta }),
    ]);
    if (z.error || m.error || e.error) { setError(true); return; }
    setZonas(z.data as Zona[]);
    setManzanas(m.data as Manzana[]);
    setEstados(e.data as EstadoManzana[]);
  }, [periodo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial y al cambiar de período
    void cargar();
  }, [cargar]);

  const total = calcularAvance(manzanas, estados);

  return (
    <div className="pila">
      <h1>Mapa de evangelismo</h1>
      <SelectorPeriodo alCambiar={setPeriodo} />
      {error && (
        <div className="aviso fila" role="alert">
          No se pudo cargar el mapa.
          <button className="boton secundario" onClick={() => void cargar()}>Reintentar</button>
        </div>
      )}
      <div className="rejilla-kpi">
        <TarjetaAvance titulo="Total" avance={total} />
        {zonas.map((z) => <TarjetaAvance key={z.id} titulo={z.nombre} avance={calcularAvance(manzanas, estados, z.id)} color={z.color_borde} />)}
      </div>
      <div className="leyenda">
        <span><i style={{ background: COLOR_ALCANZADA }} />Alcanzada</span>
        <span><i style={{ background: COLOR_SIN_PREDICAR }} />Sin predicar</span>
        <span className="tenue">La línea gruesa marca el borde de cada zona</span>
      </div>
      <MapaDinamico zonas={zonas} manzanas={manzanas} estados={estados} />
    </div>
  );
}

function TarjetaAvance({ titulo, avance, color }: { titulo: string; avance: ReturnType<typeof calcularAvance>; color?: string }) {
  return (
    <div className="kpi" style={color ? { borderTop: `4px solid ${color}` } : undefined}>
      <b>{avance.porcentaje}%</b>
      <span>{titulo}: {avance.alcanzadas} de {avance.total} manzanas</span>
      <div className="barra"><i style={{ width: `${avance.porcentaje}%` }} /></div>
    </div>
  );
}
