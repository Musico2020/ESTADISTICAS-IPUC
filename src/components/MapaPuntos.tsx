"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Sector, Zona } from "@/lib/tipos";

export type Punto = { id: string; lat: number; lon: number; color: string; ventana: string };

type Props = {
  zonas: Zona[];
  sectores?: Sector[];
  puntos?: Punto[];
  // Casa que se está registrando; con alElegir, tocar el mapa la mueve.
  marcador?: { lat: number; lon: number } | null;
  alElegir?: (lat: number, lon: number) => void;
};

export default function MapaPuntos({ zonas, sectores = [], puntos = [], marcador, alElegir }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const encuadrado = useRef(false);
  const elegir = useRef(alElegir);
  useEffect(() => { elegir.current = alElegir; }, [alElegir]);

  useEffect(() => {
    if (mapa.current || !contenedor.current) return;
    // Vista inicial en el Barrio Dangond: Leaflet no puede dibujar puntos antes de tener una vista,
    // y los puntos pueden llegar antes que las zonas con las que se encuadra el mapa.
    mapa.current = L.map(contenedor.current).setView([10.4625, -73.2585], 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(mapa.current);
    capa.current = L.layerGroup().addTo(mapa.current);
    mapa.current.on("click", (e: L.LeafletMouseEvent) => elegir.current?.(e.latlng.lat, e.latlng.lng));
    return () => { mapa.current?.remove(); mapa.current = null; encuadrado.current = false; };
  }, []);

  useEffect(() => {
    if (!mapa.current || !capa.current) return;
    const destino = capa.current;
    destino.clearLayers();
    const bordes = L.featureGroup(zonas.map((z) => L.geoJSON(z.geometria, {
      interactive: false, style: { color: z.color_borde, weight: 2, dashArray: "6 4", fill: true, fillOpacity: 0.04 },
    })));
    destino.addLayer(bordes);
    for (const s of sectores) destino.addLayer(L.geoJSON(s.geometria, { interactive: false, style: { color: s.color_borde, weight: 4, fill: false } }));
    for (const p of puntos) {
      destino.addLayer(L.circleMarker([p.lat, p.lon], { radius: 9, color: "#ffffff", weight: 2, fillColor: p.color, fillOpacity: 0.95 }).bindPopup(p.ventana));
    }
    if (marcador) {
      destino.addLayer(L.circleMarker([marcador.lat, marcador.lon], { radius: 11, color: "#1d4ed8", weight: 3, fillColor: "#22c55e", fillOpacity: 0.9 }));
    }
    if (!encuadrado.current && zonas.length) { mapa.current.fitBounds(bordes.getBounds()); encuadrado.current = true; }
  }, [zonas, sectores, puntos, marcador]);

  // Al tomar la ubicación con el GPS, el mapa se acerca a la casa. Sin animación: si la página cambia
  // a mitad del zoom, Leaflet falla al terminarlo sobre un mapa que ya no existe.
  useEffect(() => {
    if (marcador && mapa.current) mapa.current.setView([marcador.lat, marcador.lon], Math.max(mapa.current.getZoom(), 17), { animate: false });
  }, [marcador]);

  return <div ref={contenedor} className="mapa" role="application" aria-label="Mapa de cultos" />;
}
