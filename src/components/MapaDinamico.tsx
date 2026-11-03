"use client";
import dynamic from "next/dynamic";

// Leaflet usa window al importarse, por eso no se renderiza en el servidor.
export default dynamic(() => import("./MapaManzanas"), {
  ssr: false,
  loading: () => <div className="mapa tarjeta">Cargando mapa...</div>,
});
