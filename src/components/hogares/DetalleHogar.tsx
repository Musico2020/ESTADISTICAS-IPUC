"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, CalendarPlus, Crosshair, Home, Users, ArrowLeft } from "lucide-react";
import { usePerfil } from "@/components/ContextoPerfil";
import MapaPuntosDinamico from "@/components/MapaPuntosDinamico";
import FormularioHogar from "@/components/hogares/FormularioHogar";
import { Avatar, Etiquetas } from "@/components/ui/Datos";
import { useGps } from "@/lib/gps";
import type { DatosHogar, Integrante } from "@/lib/hogar/validar";
import { ETIQUETA_ESTADO, type EstadoSeguimiento } from "@/lib/persona/validar";
import { puedeCorregir } from "@/lib/roles";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { useTiempoReal } from "@/lib/tiempoReal";
import type { Zona } from "@/lib/tipos";

type Miembro = {
  id: string; nombre: string; edad: number | null; parentesco: string | null; telefono: string | null; enfermo: boolean;
  pide_oracion: boolean; peticion: string | null; entrego_vida: boolean; estado_seguimiento: EstadoSeguimiento;
};
type Hogar = {
  id: string; zona_id: string; creado_por: string; creado_en: string; familia: string; direccion: string; lat: number | null; lon: number | null;
  precision_m: number | null; telefono: string | null; calamidad: string | null; pide_oracion: boolean; peticion: string | null; atendio: string | null;
  autorizacion_menores: boolean; estado_seguimiento: EstadoSeguimiento; notas: string | null; culto_id: string | null; personas: Miembro[];
};
type Visita = { id: string; fecha: string; notas: string | null; lat: number | null; lon: number | null };

const aDatos = (h: Hogar): DatosHogar => ({
  id: h.id, zona_id: h.zona_id, familia: h.familia, direccion: h.direccion, lat: h.lat, lon: h.lon, precision_m: h.precision_m,
  telefono: h.telefono ?? "", calamidad: h.calamidad ?? "", pide_oracion: h.pide_oracion, peticion: h.peticion ?? "", atendio: h.atendio ?? "",
  autorizacion_menores: h.autorizacion_menores, estado_seguimiento: h.estado_seguimiento, notas: h.notas ?? "", culto_id: h.culto_id,
  integrantes: h.personas.map((p): Integrante => ({
    id: p.id, nombre: p.nombre, edad: p.edad === null ? "" : String(p.edad), parentesco: p.parentesco ?? "", telefono: p.telefono ?? "",
    enfermo: p.enfermo, pide_oracion: p.pide_oracion, peticion: p.peticion ?? "", entrego_vida: p.entrego_vida, estado_seguimiento: p.estado_seguimiento,
  })),
});

export default function DetalleHogar() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const perfil = usePerfil();
  const [h, setH] = useState<Hogar | null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [cargado, setCargado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [nueva, setNueva] = useState({ fecha: new Date().toISOString().slice(0, 10), notas: "", lat: null as number | null, lon: null as number | null });
  const gps = useGps();

  const cargar = useCallback(async () => {
    const db = crearClienteNavegador();
    const [r, v, z] = await Promise.all([
      db.from("hogares").select("*,personas(id,nombre,edad,parentesco,telefono,enfermo,pide_oracion,peticion,entrego_vida,estado_seguimiento,creado_en)")
        .eq("id", id).order("creado_en", { referencedTable: "personas" }).maybeSingle(),
      db.from("visitas").select("id,fecha,notas,lat,lon").eq("hogar_id", id).order("fecha", { ascending: false }),
      db.from("zonas").select("*").order("numero"),
    ]);
    setH(r.data as Hogar | null);
    setVisitas((v.data ?? []) as Visita[]);
    setZonas((z.data ?? []) as Zona[]);
    setCargado(true);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void cargar();
  }, [cargar]);
  useTiempoReal("visitas", cargar);

  const zona = useMemo(() => zonas.find((z) => z.id === h?.zona_id), [zonas, h]);
  const soloZona = useMemo(() => (zona ? [zona] : []), [zona]);
  const marcador = useMemo(() => (h?.lat != null && h?.lon != null ? { lat: h.lat, lon: h.lon } : null), [h]);

  if (!cargado) return <p className="tenue">Cargando...</p>;
  if (!h) return <p className="aviso">Este hogar no existe o no tiene permiso para verlo.</p>;

  async function registrarVisita(e: FormEvent) {
    e.preventDefault();
    if (!nueva.fecha || nueva.fecha > new Date().toISOString().slice(0, 10)) { setMensaje("Elija una fecha que no sea futura."); return; }
    // zona_id lo asigna la base de datos a partir del hogar.
    const { error } = await crearClienteNavegador().from("visitas").insert({ hogar_id: id, zona_id: h!.zona_id, fecha: nueva.fecha, notas: nueva.notas.trim() || null, lat: nueva.lat, lon: nueva.lon });
    if (error) { setMensaje("No se pudo registrar la visita. Intente de nuevo."); return; }
    setMensaje("Visita registrada.");
    setNueva({ fecha: new Date().toISOString().slice(0, 10), notas: "", lat: null, lon: null });
    void cargar();
  }

  async function eliminar() {
    if (!window.confirm("¿Eliminar este hogar con sus integrantes y visitas? Esta acción no se puede deshacer.")) return;
    const { error } = await crearClienteNavegador().from("hogares").delete().eq("id", id);
    if (error) { setMensaje("No se pudo eliminar el hogar."); return; }
    router.push("/vis");
  }

  if (editando) {
    return (
      <div className="pila">
        <div className="cabecera"><h1><Pencil size={26} /><span>Corregir hogar</span></h1>
          <button className="boton fantasma" onClick={() => setEditando(false)}>Cancelar</button></div>
        <FormularioHogar inicial={aDatos(h)} alGuardar={() => { setEditando(false); void cargar(); }} />
      </div>
    );
  }

  const datos: [string, string][] = [
    ["Zona", zona?.nombre ?? ""], ["Dirección", h.direccion], ["Teléfono", h.telefono ?? "-"], ["Recibió la visita", h.atendio ?? "-"],
    ["Calamidad o necesidad", h.calamidad ?? "-"], ["Petición del hogar", h.pide_oracion ? h.peticion ?? "Sí" : "No"],
    ["Seguimiento", ETIQUETA_ESTADO[h.estado_seguimiento]], ["Autorización para menores", h.autorizacion_menores ? "Sí" : "No"],
    ["Notas", h.notas ?? "-"], ["Registrado", h.creado_en.slice(0, 10)],
  ];

  return (
    <div className="pila">
      <div className="cabecera">
        <div>
          <h1><Home size={28} /><span>{h.familia}</span></h1>
          <p className="tenue">{h.personas.length} integrantes · {zona?.nombre}</p>
        </div>
        <div className="fila">
          <Link href="/vis" className="boton fantasma"><ArrowLeft size={16} /><span>Volver</span></Link>
          {puedeCorregir(perfil, zona, h.creado_por) && <button className="boton" onClick={() => setEditando(true)}><Pencil size={16} /><span>Corregir</span></button>}
          {perfil.rol === "administrador" && <button className="boton peligro" onClick={() => void eliminar()}><Trash2 size={16} /><span>Eliminar</span></button>}
        </div>
      </div>

      <div className="detalle-rejilla">
        <div className="tabla-envoltura">
          <table><tbody>{datos.map(([e, v]) => <tr key={e}><th scope="row">{e}</th><td>{v}</td></tr>)}</tbody></table>
        </div>
        {marcador ? <MapaPuntosDinamico zonas={soloZona} marcador={marcador} /> : <div className="tarjeta vacio"><b>Sin ubicación</b><p className="tenue">Corrija el hogar para marcarlo en el mapa.</p></div>}
      </div>

      <section className="pila" style={{ gap: 10 }}>
        <h2><Users size={20} /><span>Integrantes ({h.personas.length})</span></h2>
        <div className="tabla-envoltura">
          <table>
            <thead><tr><th>Nombre</th><th>Parentesco</th><th className="numero">Edad</th><th>Situación</th><th>Seguimiento</th></tr></thead>
            <tbody>
              {h.personas.map((p) => (
                <tr key={p.id}>
                  <td><span className="quien"><Avatar nombre={p.nombre} /><span><b>{p.nombre}</b><small>{p.telefono ?? (p.peticion ? `Petición: ${p.peticion}` : "")}</small></span></span></td>
                  <td>{p.parentesco ?? "-"}</td>
                  <td className="numero">{p.edad ?? "-"}</td>
                  <td><Etiquetas fila={p} /></td>
                  <td><span className="badge badge-tenue">{ETIQUETA_ESTADO[p.estado_seguimiento]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tarjeta pila">
        <h2><CalendarPlus size={20} /><span>Visitas ({visitas.length})</span></h2>
        {visitas.length === 0 ? <p className="tenue">Todavía no hay visitas de seguimiento registradas.</p> : (
          <ol className="linea-tiempo">
            {visitas.map((v) => <li key={v.id}><b>{v.fecha}</b><span>{v.notas ?? "Sin notas"}{v.lat !== null ? " · con ubicación" : ""}</span></li>)}
          </ol>
        )}
        <form className="pila" onSubmit={registrarVisita} style={{ gap: 10 }}>
          <div className="rejilla-campos">
            <label className="campo"><span>Fecha de la visita</span><input type="date" value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} /></label>
            <label className="campo"><span>Notas</span><input value={nueva.notas} placeholder="Cómo encontró a la familia, qué se hizo" onChange={(e) => setNueva({ ...nueva, notas: e.target.value })} /></label>
          </div>
          <div className="fila">
            <button type="button" className="boton secundario" disabled={gps.buscando} onClick={() => gps.pedir((g) => setNueva((n) => ({ ...n, lat: g.lat, lon: g.lon })))}>
              <Crosshair size={16} /><span>{nueva.lat !== null ? "Ubicación tomada" : gps.buscando ? "Buscando..." : "Agregar mi ubicación"}</span>
            </button>
            <button className="boton"><CalendarPlus size={16} /><span>Registrar visita</span></button>
          </div>
          {gps.error && <span className="error">{gps.error}</span>}
        </form>
      </section>
      {mensaje && <p className="aviso" role="status">{mensaje}</p>}
    </div>
  );
}
