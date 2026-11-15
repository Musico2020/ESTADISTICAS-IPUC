"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, PlusCircle, Radio, AlertTriangle } from "lucide-react";
import MapaPuntosDinamico from "@/components/MapaPuntosDinamico";
import SelectorPeriodo, { type Periodo } from "@/components/SelectorPeriodo";
import type { Punto } from "@/components/MapaPuntos";
import { DIAS, formatoPesos } from "@/lib/culto/validar";
import { periodoDeAnio } from "@/lib/mapa/periodo";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { escaparHtml } from "@/lib/texto";
import { useTiempoReal } from "@/lib/tiempoReal";
import type { Sector, Zona } from "@/lib/tipos";

type Culto = {
  id: string; zona_id: string; fecha: string; dia_semana: number; direccion: string; lat: number; lon: number;
  hermanos: number; amigos: number; ninos: number; ofrenda: number; hubo_enfermos: boolean;
};

export default function PaginaCultos() {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDeAnio(new Date().getFullYear()));
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [zona, setZona] = useState("");
  const [error, setError] = useState(false);
  const [nuevo, setNuevo] = useState("");

  useEffect(() => {
    const db = crearClienteNavegador();
    void Promise.all([db.from("zonas").select("*").order("numero"), db.from("sectores").select("*").order("numero")]).then(([z, s]) => {
      setZonas((z.data ?? []) as Zona[]);
      setSectores((s.data ?? []) as Sector[]);
    });
  }, []);

  const cargar = useCallback(async () => {
    let c = crearClienteNavegador().from("cultos")
      .select("id,zona_id,fecha,dia_semana,direccion,lat,lon,hermanos,amigos,ninos,ofrenda,hubo_enfermos")
      .gte("fecha", periodo.desde).lte("fecha", periodo.hasta).order("fecha", { ascending: false }).order("creado_en", { ascending: false });
    if (zona) c = c.eq("zona_id", zona);
    const { data, error: fallo } = await c;
    setError(!!fallo);
    setCultos((data ?? []) as Culto[]);
  }, [periodo, zona]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al entrar y al cambiar los filtros
    void cargar();
  }, [cargar]);

  const enVivo = useTiempoReal("cultos", useCallback(() => {
    setNuevo("Se actualizaron los cultos");
    void cargar();
    setTimeout(() => setNuevo(""), 4000);
  }, [cargar]));

  const nombreZona = useCallback((id: string) => zonas.find((z) => z.id === id)?.nombre ?? "", [zonas]);
  const puntos: Punto[] = useMemo(() => cultos.map((c) => ({
    id: c.id, lat: c.lat, lon: c.lon, color: "#22c55e",
    ventana: `<b>${escaparHtml(c.direccion)}</b><br>${DIAS[c.dia_semana]} ${c.fecha} · ${escaparHtml(nombreZona(c.zona_id))}<br>`
      + `Hermanos: ${c.hermanos} · Amigos: ${c.amigos} · Niños: ${c.ninos}<br><a href="/cultos/${c.id}">Ver detalle</a>`,
  })), [cultos, nombreZona]);

  const t = cultos.reduce((a, c) => ({ hermanos: a.hermanos + c.hermanos, amigos: a.amigos + c.amigos, ninos: a.ninos + c.ninos, ofrenda: a.ofrenda + c.ofrenda }),
    { hermanos: 0, amigos: 0, ninos: 0, ofrenda: 0 });

  return (
    <div className="pila">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div>
          <h1><Home size={28} style={{ color: "var(--marca)" }} /><span>Cultos en casas</span></h1>
          <p className="tenue">Cada casa donde se hizo culto aparece en verde, en tiempo real</p>
        </div>
        <Link href="/cultos/nuevo" className="boton"><PlusCircle size={18} /><span>Registrar culto</span></Link>
      </div>

      <div className="tarjeta" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14 }}>
        <SelectorPeriodo alCambiar={setPeriodo} />
        <label className="campo" style={{ minWidth: 180 }}>
          <span>Zona</span>
          <select value={zona} onChange={(e) => setZona(e.target.value)}>
            <option value="">Todas mis zonas</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
        <span className={`badge ${enVivo ? "badge-exito" : "badge-tenue"}`} title="Los cultos nuevos aparecen sin recargar">
          <Radio size={13} /> {enVivo ? "En vivo" : "Conectando..."}
        </span>
      </div>

      {nuevo && <p className="aviso" role="status">{nuevo}</p>}
      {error && <p className="aviso" role="alert"><AlertTriangle size={18} /><span>No se pudieron cargar los cultos.</span></p>}

      <div className="rejilla-kpi">
        <Kpi valor={cultos.length} texto="Cultos" />
        <Kpi valor={t.hermanos} texto="Hermanos" />
        <Kpi valor={t.amigos} texto="Amigos" />
        <Kpi valor={t.ninos} texto="Niños" />
        <Kpi valor={formatoPesos(t.ofrenda)} texto="Ofrenda" />
      </div>

      <MapaPuntosDinamico zonas={zonas} sectores={sectores} puntos={puntos} />

      {cultos.length === 0 ? <p className="tenue">No hay cultos registrados en este período.</p> : (
        <div className="tarjeta tabla-envoltura">
          <table>
            <thead><tr><th>Fecha</th><th>Zona</th><th>Dirección</th><th className="numero">Hermanos</th><th className="numero">Amigos</th><th className="numero">Niños</th></tr></thead>
            <tbody>
              {cultos.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/cultos/${c.id}`}>{DIAS[c.dia_semana]} {c.fecha}</Link></td>
                  <td>{nombreZona(c.zona_id)}</td>
                  <td>{c.direccion}</td>
                  <td className="numero">{c.hermanos}</td>
                  <td className="numero">{c.amigos}</td>
                  <td className="numero">{c.ninos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ valor, texto }: { valor: number | string; texto: string }) {
  return <div className="kpi"><b>{valor}</b><span>{texto}</span></div>;
}
