"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { colorManzana } from "@/lib/mapa/avance";
import type { EstadoManzana, Manzana, Zona } from "@/lib/tipos";

type Props = {
  zonas: Zona[];
  manzanas: Manzana[];
  estados: EstadoManzana[];
  seleccion?: Set<string>;
  alTocar?: (m: Manzana) => void;
};

export default function MapaManzanas({ zonas, manzanas, estados, seleccion, alTocar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const encuadrado = useRef(false);

  useEffect(() => {
    if (mapa.current || !contenedor.current) return;
    mapa.current = L.map(contenedor.current);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap",
    }).addTo(mapa.current);
    capa.current = L.layerGroup().addTo(mapa.current);
    return () => { mapa.current?.remove(); mapa.current = null; encuadrado.current = false; };
  }, []);

  useEffect(() => {
    if (!mapa.current || !capa.current) return;
    const destino = capa.current;
    destino.clearLayers();
    const porId = new Map(estados.map((e) => [e.manzana_id, e]));
    for (const m of manzanas.filter((x) => x.activa)) {
      const estado = porId.get(m.id);
      const elegida = seleccion?.has(m.id) ?? false;
      const pol = L.geoJSON(m.geometria, { style: {
        color: elegida ? "#1d4ed8" : "#475569", weight: elegida ? 3 : 1,
        fillColor: colorManzana(elegida || !!estado), fillOpacity: 0.55,
      } });
      if (alTocar) pol.on("click", () => alTocar(m));
      else pol.bindPopup(`<b>${m.codigo}</b><br>${estado ? `Última jornada: ${estado.ultima_fecha}<br>Jornadas: ${estado.jornadas}` : "Sin predicar"}`);
      destino.addLayer(pol);
    }
    const bordes = L.featureGroup(zonas.map((z) => L.geoJSON(z.geometria, {
      interactive: false, style: { color: z.color_borde, weight: 5, fill: false },
    })));
    destino.addLayer(bordes);
    if (!encuadrado.current && zonas.length) { mapa.current.fitBounds(bordes.getBounds()); encuadrado.current = true; }
  }, [zonas, manzanas, estados, seleccion, alTocar]);

  return <div ref={contenedor} className="mapa" role="application" aria-label="Mapa de manzanas" />;
}
