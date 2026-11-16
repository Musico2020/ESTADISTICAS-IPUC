"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, PlusCircle, Radio, Search, AlertTriangle, HeartPulse, HandHeart, Home, Baby } from "lucide-react";
import MapaPuntosDinamico from "@/components/MapaPuntosDinamico";
import type { Punto } from "@/components/MapaPuntos";
import { Avatar, Indicador, Vacio } from "@/components/ui/Datos";
import { COLOR_CAPA } from "@/lib/mapa/capas";
import { ETIQUETA_ESTADO, type EstadoSeguimiento } from "@/lib/persona/validar";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { escaparHtml } from "@/lib/texto";
import { useTiempoReal } from "@/lib/tiempoReal";
import type { Sector, Zona } from "@/lib/tipos";

type Miembro = { edad: number | null; enfermo: boolean; pide_oracion: boolean };
type Fila = {
  id: string; zona_id: string; familia: string; direccion: string; lat: number | null; lon: number | null; calamidad: string | null;
  pide_oracion: boolean; estado_seguimiento: EstadoSeguimiento; creado_en: string; personas: Miembro[];
};

export default function ListaHogares() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [zona, setZona] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const db = crearClienteNavegador();
    void Promise.all([db.from("zonas").select("*").order("numero"), db.from("sectores").select("*").order("numero")]).then(([z, s]) => {
      setZonas((z.data ?? []) as Zona[]);
      setSectores((s.data ?? []) as Sector[]);
    });
  }, []);

  const cargar = useCallback(async () => {
    let c = crearClienteNavegador().from("hogares")
      .select("id,zona_id,familia,direccion,lat,lon,calamidad,pide_oracion,estado_seguimiento,creado_en,personas(edad,enfermo,pide_oracion)")
      .order("creado_en", { ascending: false }).limit(500);
    if (zona) c = c.eq("zona_id", zona);
    if (busqueda.trim()) c = c.or(`familia.ilike.%${busqueda.trim().replace(/[,()]/g, " ")}%,direccion.ilike.%${busqueda.trim().replace(/[,()]/g, " ")}%`);
    const { data, error: fallo } = await c;
    setError(!!fallo);
    setFilas((data ?? []) as Fila[]);
  }, [zona, busqueda]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al entrar y al cambiar los filtros
    void cargar();
  }, [cargar]);

  const enVivo = useTiempoReal("hogares", cargar);
  useTiempoReal("personas", cargar);
  const nombreZona = useCallback((id: string) => zonas.find((z) => z.id === id)?.nombre ?? "", [zonas]);
  const puntos: Punto[] = useMemo(() => filas.filter((f) => f.lat !== null && f.lon !== null).map((f) => ({
    id: f.id, lat: f.lat!, lon: f.lon!, color: COLOR_CAPA.vis,
    ventana: `<b>${escaparHtml(f.familia)}</b> · ${f.personas.length} integrantes<br>${escaparHtml(f.direccion)}<br>${escaparHtml(nombreZona(f.zona_id))}<br><a href="/vis/${f.id}">Ver hogar</a>`,
  })), [filas, nombreZona]);
  const miembros = filas.flatMap((f) => f.personas);

  return (
    <div className="pila">
      <div className="cabecera">
        <div>
          <h1><Users size={28} /><span>VIS: hogares visitados</span></h1>
          <p className="tenue">Cada hogar con su familia completa, sus necesidades y las visitas</p>
        </div>
        <Link href="/vis/nuevo" className="boton"><PlusCircle size={18} /><span>Registrar hogar</span></Link>
      </div>

      <div className="tarjeta filtros">
        <label className="campo" style={{ flex: "1 1 220px" }}>
          <span><Search size={14} /> Buscar familia o dirección</span>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej: Pérez, Calle 17" />
        </label>
        <label className="campo">
          <span>Zona</span>
          <select value={zona} onChange={(e) => setZona(e.target.value)}>
            <option value="">Todas mis zonas</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
        <span className={`badge ${enVivo ? "badge-exito" : "badge-tenue"}`}><Radio size={13} /> {enVivo ? "En vivo" : "Conectando..."}</span>
      </div>

      {error && <p className="aviso" role="alert"><AlertTriangle size={18} /><span>No se pudieron cargar los hogares.</span></p>}

      <div className="rejilla-kpi">
        <Indicador seccion="vis" icono={<Home size={18} />} valor={filas.length} texto="Hogares" />
        <Indicador seccion="evangelismo" icono={<Users size={18} />} valor={miembros.length} texto="Personas" />
        <Indicador seccion="amigos" icono={<Baby size={18} />} valor={miembros.filter((m) => m.edad !== null && m.edad < 18).length} texto="Niños y jóvenes" />
        <Indicador seccion="casos" icono={<HeartPulse size={18} />} valor={miembros.filter((m) => m.enfermo).length} texto="Enfermos" />
        <Indicador seccion="informes" icono={<HandHeart size={18} />} valor={filas.filter((f) => f.pide_oracion || f.personas.some((m) => m.pide_oracion)).length} texto="Hogares que piden oración" />
      </div>

      <MapaPuntosDinamico zonas={zonas} sectores={sectores} puntos={puntos} />

      {filas.length === 0 ? (
        <Vacio icono={<Home size={26} />} titulo="Todavía no hay hogares visitados" texto="Registre la primera visita con el botón de arriba." />
      ) : (
        <div className="tabla-envoltura">
          <table>
            <thead><tr><th>Familia</th><th>Zona</th><th className="numero">Integrantes</th><th>Necesidad</th><th>Seguimiento</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td><Link href={`/vis/${f.id}`} className="quien"><Avatar nombre={f.familia} /><span><b>{f.familia}</b><small>{f.direccion}</small></span></Link></td>
                  <td>{nombreZona(f.zona_id)}</td>
                  <td className="numero">{f.personas.length}</td>
                  <td style={{ maxWidth: 280 }}>{f.calamidad ?? <span className="tenue">-</span>}</td>
                  <td><span className="badge badge-tenue">{ETIQUETA_ESTADO[f.estado_seguimiento]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
