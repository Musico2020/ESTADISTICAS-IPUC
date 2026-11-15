"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Baby, HeartHandshake, PlusCircle, Radio, Search, AlertTriangle } from "lucide-react";
import MapaPuntosDinamico from "@/components/MapaPuntosDinamico";
import type { Punto } from "@/components/MapaPuntos";
import { ETIQUETA_ESTADO, RUTA_TIPO, type EstadoSeguimiento, type TipoPersona } from "@/lib/persona/validar";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { escaparHtml } from "@/lib/texto";
import { useTiempoReal } from "@/lib/tiempoReal";
import type { Sector, Zona } from "@/lib/tipos";

type Fila = {
  id: string; zona_id: string; nombre: string; edad: number | null; lat: number | null; lon: number | null;
  enfermo: boolean; pide_oracion: boolean; entrego_vida: boolean; estado_seguimiento: EstadoSeguimiento; calamidad: string | null;
};
const COLOR: Record<TipoPersona, string> = { nino_vis: "#2563eb", amigo: "#9333ea" };

export default function ListaPersonas({ tipo }: { tipo: TipoPersona }) {
  const nino = tipo === "nino_vis";
  const ruta = RUTA_TIPO[tipo];
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [zona, setZona] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"" | "enfermo" | "pide_oracion" | "entrego_vida">("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const db = crearClienteNavegador();
    void Promise.all([db.from("zonas").select("*").order("numero"), db.from("sectores").select("*").order("numero")]).then(([z, s]) => {
      setZonas((z.data ?? []) as Zona[]);
      setSectores((s.data ?? []) as Sector[]);
    });
  }, []);

  const cargar = useCallback(async () => {
    let c = crearClienteNavegador().from("personas")
      .select("id,zona_id,nombre,edad,lat,lon,enfermo,pide_oracion,entrego_vida,estado_seguimiento,calamidad")
      .eq("tipo", tipo).order("creado_en", { ascending: false }).limit(500);
    if (zona) c = c.eq("zona_id", zona);
    if (filtro) c = c.eq(filtro, true);
    if (busqueda.trim()) c = c.ilike("nombre", `%${busqueda.trim()}%`);
    const { data, error: fallo } = await c;
    setError(!!fallo);
    setFilas((data ?? []) as Fila[]);
  }, [tipo, zona, filtro, busqueda]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al entrar y al cambiar los filtros
    void cargar();
  }, [cargar]);

  const enVivo = useTiempoReal("personas", cargar);
  const nombreZona = useCallback((id: string) => zonas.find((z) => z.id === id)?.nombre ?? "", [zonas]);
  const puntos: Punto[] = useMemo(() => filas.filter((f) => f.lat !== null && f.lon !== null).map((f) => ({
    id: f.id, lat: f.lat!, lon: f.lon!, color: COLOR[tipo],
    ventana: `<b>${escaparHtml(f.nombre)}</b>${f.edad !== null ? ` · ${f.edad} años` : ""}<br>${escaparHtml(nombreZona(f.zona_id))}<br><a href="${ruta}/${f.id}">Ver ficha</a>`,
  })), [filas, tipo, ruta, nombreZona]);
  const cuenta = (c: "enfermo" | "pide_oracion" | "entrego_vida") => filas.filter((f) => f[c]).length;
  const Icono = nino ? Baby : HeartHandshake;

  return (
    <div className="pila">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div>
          <h1><Icono size={28} style={{ color: "var(--marca)" }} /><span>{nino ? "VIS: niños visitados" : "Amigos"}</span></h1>
          <p className="tenue">{nino ? "Fichas de los niños que se visitan, con sus necesidades y visitas" : "Amigos alcanzados en cultos y evangelismo, con su seguimiento"}</p>
        </div>
        <Link href={`${ruta}/nuevo`} className="boton"><PlusCircle size={18} /><span>{nino ? "Registrar niño" : "Registrar amigo"}</span></Link>
      </div>

      <div className="tarjeta" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14 }}>
        <label className="campo" style={{ flex: "1 1 200px" }}>
          <span><Search size={14} /> Buscar por nombre</span>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Escriba un nombre" />
        </label>
        <label className="campo" style={{ minWidth: 160 }}>
          <span>Zona</span>
          <select value={zona} onChange={(e) => setZona(e.target.value)}>
            <option value="">Todas mis zonas</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
        <label className="campo" style={{ minWidth: 160 }}>
          <span>Mostrar</span>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="">Todos</option>
            <option value="enfermo">Enfermos</option>
            <option value="pide_oracion">Piden oración</option>
            <option value="entrego_vida">Se entregaron a Cristo</option>
          </select>
        </label>
        <span className={`badge ${enVivo ? "badge-exito" : "badge-tenue"}`}><Radio size={13} /> {enVivo ? "En vivo" : "Conectando..."}</span>
      </div>

      {error && <p className="aviso" role="alert"><AlertTriangle size={18} /><span>No se pudieron cargar las fichas.</span></p>}

      <div className="rejilla-kpi">
        <div className="kpi"><b>{filas.length}</b><span>{nino ? "Niños" : "Amigos"}</span></div>
        <div className="kpi"><b>{cuenta("enfermo")}</b><span>Enfermos</span></div>
        <div className="kpi"><b>{cuenta("pide_oracion")}</b><span>Piden oración</span></div>
        <div className="kpi"><b>{cuenta("entrego_vida")}</b><span>Se entregaron a Cristo</span></div>
      </div>

      <MapaPuntosDinamico zonas={zonas} sectores={sectores} puntos={puntos} />

      {filas.length === 0 ? <p className="tenue">No hay fichas con estos filtros.</p> : (
        <div className="tarjeta tabla-envoltura">
          <table>
            <thead><tr><th>Nombre</th><th className="numero">Edad</th><th>Zona</th><th>Situación</th><th>Seguimiento</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td><Link href={`${ruta}/${f.id}`}>{f.nombre}</Link></td>
                  <td className="numero">{f.edad ?? "-"}</td>
                  <td>{nombreZona(f.zona_id)}</td>
                  <td>{[f.enfermo && "Enfermo", f.pide_oracion && "Pide oración", f.entrego_vida && "Se entregó"].filter(Boolean).join(" · ") || "-"}</td>
                  <td>{ETIQUETA_ESTADO[f.estado_seguimiento]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
