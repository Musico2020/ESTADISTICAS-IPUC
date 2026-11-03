"use client";
import { useState } from "react";
import { periodoDeAnio } from "@/lib/mapa/periodo";

export type Periodo = { desde: string; hasta: string };

export default function SelectorPeriodo({ alCambiar }: { alCambiar: (p: Periodo) => void }) {
  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: Math.max(anioActual - 2026 + 1, 1) }, (_, i) => anioActual - i);
  const [modo, setModo] = useState(String(anioActual));
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  function elegirModo(valor: string) {
    setModo(valor);
    if (valor !== "rango") alCambiar(periodoDeAnio(Number(valor)));
    else if (desde && hasta) alCambiar({ desde, hasta });
  }
  function elegirFecha(d: string, h: string) {
    setDesde(d);
    setHasta(h);
    if (d && h && d <= h) alCambiar({ desde: d, hasta: h });
  }

  return (
    <div className="fila">
      <label className="campo"><span>Período</span>
        <select value={modo} onChange={(e) => elegirModo(e.target.value)}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          <option value="rango">Rango de fechas</option>
        </select>
      </label>
      {modo === "rango" && (
        <>
          <label className="campo"><span>Desde</span><input type="date" value={desde} onChange={(e) => elegirFecha(e.target.value, hasta)} /></label>
          <label className="campo"><span>Hasta</span><input type="date" value={hasta} onChange={(e) => elegirFecha(desde, e.target.value)} /></label>
        </>
      )}
    </div>
  );
}
