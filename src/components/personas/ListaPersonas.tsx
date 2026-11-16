"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HeartHandshake, PlusCircle, Radio, Search, AlertTriangle, HeartPulse, HandHeart, Sparkles, Users } from "lucide-react";
import MapaPuntosDinamico from "@/components/MapaPuntosDinamico";
import type { Punto } from "@/components/MapaPuntos";
import { Avatar, Etiquetas, Indicador, Vacio } from "@/components/ui/Datos";
import { COLOR_CAPA } from "@/lib/mapa/capas";
import { ETIQUETA_ESTADO, type EstadoSeguimiento } from "@/lib/persona/validar";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { escaparHtml } from "@/lib/texto";
import { useTiempoReal } from "@/lib/tiempoReal";
import type { Sector, Zona } from "@/lib/tipos";

type Fila = {
  id: string; zona_id: string; nombre: string; edad: number | null; lat: number | null; lon: number | null; telefono: string | null;
  enfermo: boolean; pide_oracion: boolean; entrego_vida: boolean; estado_seguimiento: EstadoSeguimiento;
};

export default function ListaPersonas() {
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
      .select("id,zona_id,nombre,edad,lat,lon,telefono,enfermo,pide_oracion,entrego_vida,estado_seguimiento")
      .eq("tipo", "amigo").order("creado_en", { ascending: false }).limit(500);
    if (zona) c = c.eq("zona_id", zona);
    if (filtro) c = c.eq(filtro, true);
    if (busqueda.trim()) c = c.ilike("nombre", `%${busqueda.trim()}%`);
    const { data, error: fallo } = await c;
    setError(!!fallo);
    setFilas((data ?? []) as Fila[]);
  }, [zona, filtro, busqueda]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al entrar y al cambiar los filtros
    void cargar();
  }, [cargar]);

  const enVivo = useTiempoReal("personas", cargar);
  const nombreZona = useCallback((id: string) => zonas.find((z) => z.id === id)?.nombre ?? "", [zonas]);
  const puntos: Punto[] = useMemo(() => filas.filter((f) => f.lat !== null && f.lon !== null).map((f) => ({
    id: f.id, lat: f.lat!, lon: f.lon!, color: COLOR_CAPA.amigos,
    ventana: `<b>${escaparHtml(f.nombre)}</b>${f.edad !== null ? ` · ${f.edad} años` : ""}<br>${escaparHtml(nombreZona(f.zona_id))}<br><a href="/amigos/${f.id}">Ver ficha</a>`,
  })), [filas, nombreZona]);
  const cuenta = (c: "enfermo" | "pide_oracion" | "entrego_vida") => filas.filter((f) => f[c]).length;

  return (
    <div className="pila">
      <div className="cabecera">
        <div>
          <h1><HeartHandshake size={28} /><span>Amigos</span></h1>
          <p className="tenue">Amigos alcanzados en cultos y evangelismo, con su seguimiento</p>
        </div>
        <Link href="/amigos/nuevo" className="boton"><PlusCircle size={18} /><span>Registrar amigo</span></Link>
      </div>

      <div className="tarjeta filtros">
        <label className="campo" style={{ flex: "1 1 220px" }}>
          <span><Search size={14} /> Buscar por nombre</span>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Escriba un nombre" />
        </label>
        <label className="campo">
          <span>Zona</span>
          <select value={zona} onChange={(e) => setZona(e.target.value)}>
            <option value="">Todas mis zonas</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
        <label className="campo">
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
        <Indicador seccion="amigos" icono={<Users size={18} />} valor={filas.length} texto="Amigos" />
        <Indicador seccion="casos" icono={<HeartPulse size={18} />} valor={cuenta("enfermo")} texto="Enfermos" />
        <Indicador seccion="informes" icono={<HandHeart size={18} />} valor={cuenta("pide_oracion")} texto="Piden oración" />
        <Indicador seccion="cultos" icono={<Sparkles size={18} />} valor={cuenta("entrego_vida")} texto="Se entregaron a Cristo" />
      </div>

      <MapaPuntosDinamico zonas={zonas} sectores={sectores} puntos={puntos} />

      {filas.length === 0 ? <Vacio icono={<HeartHandshake size={26} />} titulo="No hay amigos con estos filtros" texto="Registre el primero con el botón de arriba." /> : (
        <div className="tabla-envoltura">
          <table>
            <thead><tr><th>Nombre</th><th>Zona</th><th>Situación</th><th>Seguimiento</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td><Link href={`/amigos/${f.id}`} className="quien"><Avatar nombre={f.nombre} /><span><b>{f.nombre}</b><small>{[f.edad !== null && `${f.edad} años`, f.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}</small></span></Link></td>
                  <td>{nombreZona(f.zona_id)}</td>
                  <td><Etiquetas fila={f} /></td>
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
