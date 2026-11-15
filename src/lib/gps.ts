"use client";
import { useState } from "react";

export type Posicion = { lat: number; lon: number; precision: number };

// Pide la ubicación al celular una sola vez; no sigue a nadie.
export function useGps() {
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  function pedir(alObtener: (p: Posicion) => void) {
    setError("");
    if (!navigator.geolocation) { setError("Este dispositivo no permite obtener la ubicación."); return; }
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setBuscando(false); alObtener({ lat: pos.coords.latitude, lon: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) }); },
      () => { setBuscando(false); setError("No se pudo obtener la ubicación. Active el GPS y dé permiso."); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }
  return { buscando, error, pedir };
}
