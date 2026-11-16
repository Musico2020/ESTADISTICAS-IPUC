"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Radio, SlidersHorizontal, AlertCircle, ChevronDown } from "lucide-react";
import type { PuntoMapa } from "@/components/MapaInteractivo";
import { calcularAvance, COLOR_ALCANZADA, COLOR_SIN_PREDICAR } from "@/lib/mapa/avance";
import { CAPAS_INICIALES, COLOR_CAPA, enZonas, filtrarPorSituacion, rangoDe, zonasFiltradas, type Capas, type PeriodoMapa, type Situacion } from "@/lib/mapa/capas";
import { DIAS } from "@/lib/culto/validar";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { escaparHtml } from "@/lib/texto";
import { useTiempoReal, type CambioTabla } from "@/lib/tiempoReal";
import type { EstadoManzana, Manzana, Sector, Zona } from "@/lib/tipos";

// Leaflet usa window al importarse, por eso no se renderiza en el servidor.
const MapaInteractivo = dynamic(() => import("@/components/MapaInteractivo"), {
  ssr: false, loading: () => <div className="mapa mapa-grande tarjeta">Cargando mapa...</div>,
});

type Culto = { id: string; zona_id: string; fecha: string; dia_semana: number; direccion: string; lat: number; lon: number; hermanos: number; amigos: number; ninos: number; hubo_enfermos: boolean };
type Persona = { id: string; tipo: "amigo"; zona_id: string; nombre: string; edad: number | null; lat: number; lon: number; enfermo: boolean; pide_oracion: boolean; entrego_vida: boolean };
type Miembro = { edad: number | null; enfermo: boolean; pide_oracion: boolean; entrego_vida: boolean };
type HogarFila = { id: string; zona_id: string; familia: string; direccion: string; lat: number; lon: number; pide_oracion: boolean; personas: Miembro[] };
// Un hogar cuenta como enfermo, con oración o con entrega si alguno de sus integrantes lo está.
type Hogar = Omit<HogarFila, "personas"> & { integrantes: number; enfermo: boolean; entrego_vida: boolean };
const aHogar = ({ personas, ...h }: HogarFila): Hogar => ({
  ...h, integrantes: personas.length, enfermo: personas.some((p) => p.enfermo),
  pide_oracion: h.pide_oracion || personas.some((p) => p.pide_oracion), entrego_vida: personas.some((p) => p.entrego_vida),
});

const AVISO_TABLA: Record<string, string> = { cultos: "Nuevo culto", personas: "Nueva ficha", hogares: "Nuevo hogar visitado", reportes: "Nueva jornada de evangelismo" };

export default function PaginaMapa() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [manzanas, setManzanas] = useState<Manzana[]>([]);
  const [estados, setEstados] = useState<EstadoManzana[]>([]);
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [hogares, setHogares] = useState<Hogar[]>([]);
  const [capas, setCapas] = useState<Capas>(CAPAS_INICIALES);
  const [sector, setSector] = useState("");
  const [zona, setZona] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoMapa>("anio");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [situacion, setSituacion] = useState<Situacion>("");
  const [error, setError] = useState(false);
  const [aviso, setAviso] = useState("");
  const [panelAbierto, setPanelAbierto] = useState(false);

  const rango = useMemo(() => rangoDe(periodo, new Date(), desde, hasta), [periodo, desde, hasta]);

  useEffect(() => {
    const db = crearClienteNavegador();
    void Promise.all([
      db.from("zonas").select("*").order("numero"), db.from("sectores").select("*").order("numero"), db.from("manzanas").select("*").order("codigo"),
    ]).then(([z, s, m]) => {
      if (z.error || s.error || m.error) { setError(true); return; }
      setZonas(z.data as Zona[]); setSectores(s.data as Sector[]); setManzanas(m.data as Manzana[]);
    });
  }, []);

  const cargar = useCallback(async () => {
    const db = crearClienteNavegador();
    // RLS deja a cada persona ver solo los registros de su alcance.
    const [e, c, p, h] = await Promise.all([
      db.rpc("estado_manzanas", { p_desde: rango.desde, p_hasta: rango.hasta }),
      db.from("cultos").select("id,zona_id,fecha,dia_semana,direccion,lat,lon,hermanos,amigos,ninos,hubo_enfermos").gte("fecha", rango.desde).lte("fecha", rango.hasta),
      db.from("personas").select("id,tipo,zona_id,nombre,edad,lat,lon,enfermo,pide_oracion,entrego_vida").eq("tipo", "amigo").not("lat", "is", null)
        .gte("creado_en", rango.desde).lte("creado_en", `${rango.hasta}T23:59:59`),
      db.from("hogares").select("id,zona_id,familia,direccion,lat,lon,pide_oracion,personas(edad,enfermo,pide_oracion,entrego_vida)").not("lat", "is", null)
        .gte("creado_en", rango.desde).lte("creado_en", `${rango.hasta}T23:59:59`),
    ]);
    setError(!!(e.error || c.error || p.error || h.error));
    setEstados((e.data ?? []) as EstadoManzana[]); setCultos((c.data ?? []) as Culto[]); setPersonas((p.data ?? []) as Persona[]);
    setHogares(((h.data ?? []) as HogarFila[]).map(aHogar));
  }, [rango]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al entrar y al cambiar el período
    void cargar();
  }, [cargar]);

  const nombreZona = useCallback((id: string) => zonas.find((z) => z.id === id)?.nombre ?? "", [zonas]);
  const alCambiar = useCallback((cambio: CambioTabla) => {
    if (cambio.eventType === "INSERT") {
      const fila = cambio.new as { zona_id?: string };
      setAviso(`${AVISO_TABLA[cambio.table] ?? "Nuevo registro"}${fila.zona_id ? ` en ${nombreZona(fila.zona_id)}` : ""}`);
      setTimeout(() => setAviso(""), 5000);
    }
    void cargar();
  }, [cargar, nombreZona]);
  const v1 = useTiempoReal("cultos", alCambiar);
  const v2 = useTiempoReal("personas", alCambiar);
  const v3 = useTiempoReal("reportes", alCambiar);
  const v4 = useTiempoReal("hogares", alCambiar);
  const enVivo = v1 && v2 && v3 && v4;

  const visibles = useMemo(() => zonasFiltradas(zonas, sector, zona), [zonas, sector, zona]);
  const filtrado = useMemo(() => filtrarPorSituacion(enZonas(personas, visibles), enZonas(cultos, visibles), situacion), [personas, cultos, visibles, situacion]);
  const hogaresVisibles = useMemo(() => enZonas(hogares, visibles).filter((h) => !situacion || h[situacion]), [hogares, visibles, situacion]);
  const manzanasVisibles = useMemo(() => enZonas(manzanas, visibles), [manzanas, visibles]);
  const avance = calcularAvance(manzanasVisibles, estados);

  const puntosCultos: PuntoMapa[] = useMemo(() => filtrado.cultos.map((c) => ({
    id: c.id, lat: c.lat, lon: c.lon,
    ventana: `<b>Culto · ${escaparHtml(c.direccion)}</b><br>${DIAS[c.dia_semana]} ${c.fecha} · ${escaparHtml(nombreZona(c.zona_id))}<br>Hermanos ${c.hermanos} · Amigos ${c.amigos} · Niños ${c.ninos}${c.hubo_enfermos ? "<br>Hubo enfermos" : ""}<br><a href="/cultos/${c.id}">Ver detalle</a>`,
  })), [filtrado.cultos, nombreZona]);
  const situaciones = (p: { enfermo: boolean; pide_oracion: boolean; entrego_vida: boolean }) =>
    [p.enfermo && "Enfermo", p.pide_oracion && "Pide oración", p.entrego_vida && "Se entregó a Cristo"].filter(Boolean).join(" · ") || "Sin novedades";
  const puntosVis: PuntoMapa[] = useMemo(() => hogaresVisibles.map((h) => ({
    id: h.id, lat: h.lat, lon: h.lon,
    ventana: `<b>VIS · ${escaparHtml(h.familia)}</b> · ${h.integrantes} integrantes<br>${escaparHtml(h.direccion)}<br>${escaparHtml(nombreZona(h.zona_id))}<br>${situaciones(h)}<br><a href="/vis/${h.id}">Ver hogar</a>`,
  })), [hogaresVisibles, nombreZona]);
  const puntosAmigos: PuntoMapa[] = useMemo(() => filtrado.personas.map((p) => ({
    id: p.id, lat: p.lat, lon: p.lon,
    ventana: `<b>Amigo · ${escaparHtml(p.nombre)}</b>${p.edad !== null ? ` · ${p.edad} años` : ""}<br>${escaparHtml(nombreZona(p.zona_id))}<br>${situaciones(p)}<br><a href="/amigos/${p.id}">Ver ficha</a>`,
  })), [filtrado.personas, nombreZona]);
  const ventanaManzana = useCallback((m: Manzana, e: EstadoManzana | undefined) =>
    `<b>Manzana ${escaparHtml(m.codigo)}</b><br>${escaparHtml(nombreZona(m.zona_id))}<br>${e ? `Última jornada: ${e.ultima_fecha}<br>Jornadas: ${e.jornadas}` : "Sin predicar en este período"}`, [nombreZona]);

  const capa = (c: keyof Capas, texto: string, color: string | null, cuenta?: number) => (
    <label className="capa-mapa">
      <input type="checkbox" checked={capas[c]} onChange={(e) => setCapas({ ...capas, [c]: e.target.checked })} />
      {color ? <i style={{ background: color }} /> : <i className="capa-borde" />}
      <span>{texto}</span>
      {cuenta !== undefined && <b>{cuenta}</b>}
    </label>
  );

  return (
    <div className="pila">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h1><MapPin size={28} /><span>Mapa interactivo</span></h1>
        <span className={`badge ${enVivo ? "badge-exito" : "badge-tenue"}`} title="Lo nuevo aparece sin recargar"><Radio size={13} /> {enVivo ? "En vivo" : "Conectando..."}</span>
      </div>
      {error && <p className="aviso" role="alert"><AlertCircle size={18} /><span>No se pudo cargar parte del mapa. Revise la conexión.</span></p>}

      <div className="mapa-marco">
        <aside className={`mapa-panel ${panelAbierto ? "abierto" : ""}`}>
          <button type="button" className="mapa-panel-boton" onClick={() => setPanelAbierto(!panelAbierto)} aria-expanded={panelAbierto}>
            <SlidersHorizontal size={16} /><span>Capas y filtros</span><ChevronDown size={16} className="girable" />
          </button>
          <div className="mapa-panel-contenido">
            <div>
              <h3 className="mapa-titulo">Capas</h3>
              {capa("manzanas", "Manzanas", COLOR_SIN_PREDICAR, manzanasVisibles.filter((m) => m.activa).length)}
              {capa("cultos", "Casas con culto", COLOR_CAPA.cultos, filtrado.cultos.length)}
              {capa("vis", "Hogares VIS", COLOR_CAPA.vis, puntosVis.length)}
              {capa("amigos", "Amigos", COLOR_CAPA.amigos, puntosAmigos.length)}
              {capa("bordes", "Bordes de sectores y zonas", null)}
            </div>
            <div className="pila" style={{ gap: 8 }}>
              <h3 className="mapa-titulo">Filtros</h3>
              <select aria-label="Sector" value={sector} onChange={(e) => { setSector(e.target.value); setZona(""); }}>
                <option value="">Todos los sectores</option>
                {sectores.map((s) => <option key={s.id} value={s.id}>Sector {s.numero}</option>)}
              </select>
              <select aria-label="Zona" value={zona} onChange={(e) => setZona(e.target.value)}>
                <option value="">Todas las zonas</option>
                {zonasFiltradas(zonas, sector, "").map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
              <select aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoMapa)}>
                <option value="mes">Este mes</option>
                <option value="anio">Este año</option>
                <option value="todo">Todo</option>
                <option value="rango">Rango de fechas</option>
              </select>
              {periodo === "rango" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <input type="date" aria-label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} />
                  <input type="date" aria-label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </div>
              )}
              <select aria-label="Situación" value={situacion} onChange={(e) => setSituacion(e.target.value as Situacion)}>
                <option value="">Todo</option>
                <option value="enfermo">Solo enfermos</option>
                <option value="pide_oracion">Solo piden oración</option>
                <option value="entrego_vida">Solo se entregaron a Cristo</option>
              </select>
            </div>
            <div>
              <h3 className="mapa-titulo">En pantalla</h3>
              <div className="mapa-kpis">
                <div><b>{avance.porcentaje}%</b><span>Avance manzanas</span></div>
                <div><b>{filtrado.cultos.length}</b><span>Cultos</span></div>
                <div><b>{hogaresVisibles.length}</b><span>Hogares VIS</span></div>
                <div><b>{filtrado.personas.length}</b><span>Amigos</span></div>
              </div>
            </div>
          </div>
        </aside>
        <div className="mapa-lienzo">
          {aviso && <div className="mapa-aviso" role="status">{aviso}</div>}
          <MapaInteractivo zonas={visibles} sectores={sector || zona ? [] : sectores} manzanas={manzanas} estados={estados}
            cultos={puntosCultos} vis={puntosVis} amigos={puntosAmigos} capas={capas} ventanaManzana={ventanaManzana} />
        </div>
      </div>

      <div className="leyenda">
        <span><i style={{ background: COLOR_ALCANZADA }} />Manzana alcanzada</span>
        <span><i style={{ background: COLOR_SIN_PREDICAR }} />Sin predicar</span>
        <span><i style={{ background: COLOR_CAPA.cultos, borderRadius: "50%" }} />Culto</span>
        <span><i style={{ background: COLOR_CAPA.vis, borderRadius: "50%" }} />Hogar VIS</span>
        <span><i style={{ background: COLOR_CAPA.amigos, borderRadius: "50%" }} />Amigo</span>
      </div>

      <h2>Avance de manzanas por zona</h2>
      <section className="tabla-envoltura">
        <table>
          <thead><tr><th>Sector</th><th>Zona</th><th className="numero">Alcanzadas</th><th className="numero">Avance</th></tr></thead>
          <tbody>
            {visibles.map((z) => {
              const a = calcularAvance(manzanas, estados, z.id);
              return <tr key={z.id}><td>{sectores.find((s) => s.id === z.sector_id)?.numero}</td><td>{z.nombre}</td><td className="numero">{a.alcanzadas}/{a.total}</td><td className="numero">{a.porcentaje}%</td></tr>;
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
