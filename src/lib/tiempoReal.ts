"use client";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { crearClienteNavegador } from "@/lib/supabase/cliente";

// Avisa cada vez que cambia la tabla. Supabase solo entrega los cambios que el usuario puede ver por RLS.
export function useTiempoReal(tabla: string, alCambiar: () => void) {
  const aviso = useRef(alCambiar);
  const [conectado, setConectado] = useState(false);
  useEffect(() => { aviso.current = alCambiar; }, [alCambiar]);
  useEffect(() => {
    const db = crearClienteNavegador();
    let canal: RealtimeChannel | null = null;
    let activo = true;
    void (async () => {
      // Sin esto el canal se abre como visitante anónimo y RLS no le entrega ningún cambio.
      const { data } = await db.auth.getSession();
      if (!activo) return;
      if (data.session) await db.realtime.setAuth(data.session.access_token);
      canal = db
        .channel(`tiempo-real-${tabla}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: tabla }, () => aviso.current())
        .subscribe((estado) => setConectado(estado === "SUBSCRIBED"));
    })();
    return () => {
      activo = false;
      if (canal) void db.removeChannel(canal);
    };
  }, [tabla]);
  return conectado;
}
