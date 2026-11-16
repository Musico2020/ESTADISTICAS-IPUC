"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { colorManzana } from "@/lib/mapa/avance";
import { COLOR_CAPA, type Capas } from "@/lib/mapa/capas";
import type { EstadoManzana, Manzana, Sector, Zona } from "@/lib/tipos";

export type PuntoMapa = { id: string; lat: number; lon: number; ventana: string };

type Props = {
  zonas: Zona[]; sectores: Sector[]; manzanas: Manzana[]; estados: EstadoManzana[];
  cultos: PuntoMapa[]; vis: PuntoMapa[]; amigos: PuntoMapa[]; capas: Capas;
  ventanaManzana: (m: Manzana, e: EstadoManzana | undefined) => string;
};

export default function MapaInteractivo({ zonas, sectores, manzanas, estados, cultos, vis, amigos, capas, ventanaManzana }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const encuadre = useRef("");

  useEffect(() => {
    if (mapa.current || !contenedor.current) return;
    // Vista inicial en el Barrio Dangond: Leaflet no dibuja puntos antes de tener una vista.
    mapa.current = L.map(contenedor.current).setView([10.4625, -73.2585], 15);
    // Si el contenedor cambia de tamaño después de crear el mapa (letra, menú, paneles), Leaflet debe recalcular o deja cuadros grises.
    const tamano = new ResizeObserver(() => mapa.current?.invalidateSize({ animate: false }));
    tamano.observe(contenedor.current);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(mapa.current);
    capa.current = L.layerGroup().addTo(mapa.current);
    return () => { tamano.disconnect(); mapa.current?.remove(); mapa.current = null; encuadre.current = ""; };
  }, []);

  useEffect(() => {
    if (!mapa.current || !capa.current) return;
    const destino = capa.current;
    destino.clearLayers();
    const ids = new Set(zonas.map((z) => z.id));
    if (capas.manzanas) {
      const porId = new Map(estados.map((e) => [e.manzana_id, e]));
      for (const m of manzanas) {
        if (!m.activa || !ids.has(m.zona_id)) continue;
        const e = porId.get(m.id);
        destino.addLayer(L.geoJSON(m.geometria, { style: { color: "#475569", weight: 1, fillColor: colorManzana(!!e), fillOpacity: 0.38 } }).bindPopup(ventanaManzana(m, e)));
      }
    }
    if (capas.bordes) {
      for (const z of zonas) destino.addLayer(L.geoJSON(z.geometria, { interactive: false, style: { color: z.color_borde, weight: 2, dashArray: "6 4", fill: false } }));
      for (const s of sectores) destino.addLayer(L.geoJSON(s.geometria, { interactive: false, style: { color: s.color_borde, weight: 5, fill: false } }));
    }
    const puntos = (lista: PuntoMapa[], color: string, radio: number) => {
      for (const p of lista) destino.addLayer(L.circleMarker([p.lat, p.lon], { radius: radio, color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 0.95 }).bindPopup(p.ventana));
    };
    if (capas.cultos) puntos(cultos, COLOR_CAPA.cultos, 9);
    if (capas.vis) puntos(vis, COLOR_CAPA.vis, 7);
    if (capas.amigos) puntos(amigos, COLOR_CAPA.amigos, 7);

    // Encuadra al cambiar el sector o la zona filtrados, no en cada punto nuevo.
    const clave = zonas.map((z) => z.id).join(",");
    if (clave && clave !== encuadre.current) {
      // El recuadro puede haber cambiado de tamaño (celular, panel), y el encuadre se calcula con ese tamaño.
      mapa.current.invalidateSize();
      mapa.current.fitBounds(L.featureGroup(zonas.map((z) => L.geoJSON(z.geometria))).getBounds(), { animate: false, padding: [12, 12] });
      encuadre.current = clave;
    }
  }, [zonas, sectores, manzanas, estados, cultos, vis, amigos, capas, ventanaManzana]);

  return <div ref={contenedor} className="mapa mapa-grande" role="application" aria-label="Mapa interactivo" />;
}
