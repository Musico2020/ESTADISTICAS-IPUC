"use client";
import { useState } from "react";
import { Calendar, Filter } from "lucide-react";
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
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <div className="campo" style={{ minWidth: 140 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--tenue)" }}>
          <Calendar size={14} /> Período
        </span>
        <select
          value={modo}
          onChange={(e) => elegirModo(e.target.value)}
          style={{ minHeight: 40, padding: "6px 12px" }}
        >
          {anios.map((a) => (
            <option key={a} value={a}>
              Año {a}
            </option>
          ))}
          <option value="rango">Personalizado...</option>
        </select>
      </div>

      {modo === "rango" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="campo">
            <span style={{ fontSize: "0.8rem", color: "var(--tenue)" }}>Desde</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => elegirFecha(e.target.value, hasta)}
              style={{ minHeight: 40, padding: "6px 10px" }}
            />
          </div>
          <div className="campo">
            <span style={{ fontSize: "0.8rem", color: "var(--tenue)" }}>Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => elegirFecha(desde, e.target.value)}
              style={{ minHeight: 40, padding: "6px 10px" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
