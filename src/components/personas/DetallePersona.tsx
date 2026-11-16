"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, CalendarPlus, Crosshair, User } from "lucide-react";
import { usePerfil } from "@/components/ContextoPerfil";
import MapaPuntosDinamico from "@/components/MapaPuntosDinamico";
import FormularioPersona from "@/components/personas/FormularioPersona";
import { useGps } from "@/lib/gps";
import { ETIQUETA_ESTADO, type DatosPersona, type EstadoSeguimiento } from "@/lib/persona/validar";
import { puedeCorregir } from "@/lib/roles";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { useTiempoReal } from "@/lib/tiempoReal";
import type { Zona } from "@/lib/tipos";

type Persona = Omit<DatosPersona, "edad" | "telefono" | "direccion" | "familia" | "calamidad" | "peticion" | "notas"> & {
  id: string; creado_por: string; creado_en: string; edad: number | null; telefono: string | null; direccion: string | null;
  familia: string | null; calamidad: string | null; peticion: string | null; notas: string | null;
};
type Visita = { id: string; fecha: string; notas: string | null; lat: number | null; lon: number | null };

const aDatos = (p: Persona): DatosPersona => ({
  ...p, edad: p.edad === null ? "" : String(p.edad), telefono: p.telefono ?? "", direccion: p.direccion ?? "",
  familia: p.familia ?? "", calamidad: p.calamidad ?? "", peticion: p.peticion ?? "", notas: p.notas ?? "",
});

export default function DetallePersona() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const perfil = usePerfil();
  const ruta = "/amigos";
  const [p, setP] = useState<Persona | null>(null);
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
      db.from("personas").select("*").eq("id", id).eq("tipo", "amigo").maybeSingle(),
      db.from("visitas").select("id,fecha,notas,lat,lon").eq("persona_id", id).order("fecha", { ascending: false }),
      db.from("zonas").select("*").order("numero"),
    ]);
    setP(r.data as Persona | null);
    setVisitas((v.data ?? []) as Visita[]);
    setZonas((z.data ?? []) as Zona[]);
    setCargado(true);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void cargar();
  }, [cargar]);
  useTiempoReal("visitas", cargar);

  const zona = useMemo(() => zonas.find((z) => z.id === p?.zona_id), [zonas, p]);
  const soloZona = useMemo(() => (zona ? [zona] : []), [zona]);
  const marcador = useMemo(() => (p?.lat != null && p?.lon != null ? { lat: p.lat, lon: p.lon } : null), [p]);

  if (!cargado) return <p className="tenue">Cargando...</p>;
  if (!p) return <p className="aviso">Esta ficha no existe o no tiene permiso para verla.</p>;

  async function registrarVisita(e: FormEvent) {
    e.preventDefault();
    if (!nueva.fecha || nueva.fecha > new Date().toISOString().slice(0, 10)) { setMensaje("Elija una fecha que no sea futura."); return; }
    // zona_id lo asigna la base de datos a partir de la persona.
    const { error } = await crearClienteNavegador().from("visitas").insert({ persona_id: id, zona_id: p!.zona_id, fecha: nueva.fecha, notas: nueva.notas.trim() || null, lat: nueva.lat, lon: nueva.lon });
    if (error) { setMensaje("No se pudo registrar la visita. Intente de nuevo."); return; }
    setMensaje("Visita registrada.");
    setNueva({ fecha: new Date().toISOString().slice(0, 10), notas: "", lat: null, lon: null });
    void cargar();
  }

  async function eliminar() {
    if (!window.confirm("¿Eliminar esta ficha y sus visitas? Esta acción no se puede deshacer.")) return;
    const { error } = await crearClienteNavegador().from("personas").delete().eq("id", id);
    if (error) { setMensaje("No se pudo eliminar la ficha."); return; }
    router.push(ruta);
  }

  if (editando) {
    return (
      <div className="pila">
        <h1><Pencil size={26} /><span>Corregir ficha</span></h1>
        <FormularioPersona inicial={aDatos(p)} personaId={p.id} alGuardar={() => { setEditando(false); void cargar(); }} />
        <button className="boton secundario" onClick={() => setEditando(false)}>Cancelar</button>
      </div>
    );
  }

  const filas: [string, string][] = [
    ["Zona", zona?.nombre ?? ""], ["Edad", p.edad === null ? "-" : `${p.edad} años`], ["Teléfono", p.telefono ?? "-"],
    ["Familia", p.familia ?? "-"], ["Dirección", p.direccion ?? "-"], ["Calamidad o necesidad", p.calamidad ?? "-"],
    ["Enfermo", p.enfermo ? "Sí" : "No"], ["Petición de oración", p.pide_oracion ? p.peticion ?? "Sí" : "No"],
    ["Se entregó a Cristo", p.entrego_vida ? "Sí" : "No"], ["Seguimiento", ETIQUETA_ESTADO[p.estado_seguimiento as EstadoSeguimiento]],
    ["Notas", p.notas ?? "-"], ["Registrado", p.creado_en.slice(0, 10)],
  ];

  return (
    <div className="pila">
      <h1><User size={28} /><span>{p.nombre}</span></h1>
      {marcador && <MapaPuntosDinamico zonas={soloZona} marcador={marcador} />}
      <div className="tarjeta tabla-envoltura">
        <table><tbody>{filas.map(([e, v]) => <tr key={e}><th scope="row">{e}</th><td>{v}</td></tr>)}</tbody></table>
      </div>

      <section className="tarjeta pila">
        <h2><CalendarPlus size={20} /><span>Visitas ({visitas.length})</span></h2>
        {visitas.length === 0 ? <p className="tenue">Todavía no hay visitas registradas.</p> : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {visitas.map((v) => <li key={v.id}><b>{v.fecha}</b>{v.notas ? `: ${v.notas}` : ""}{v.lat !== null ? " (con ubicación)" : ""}</li>)}
          </ul>
        )}
        <form className="pila" onSubmit={registrarVisita} style={{ gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <label className="campo"><span>Fecha de la visita</span><input type="date" value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} /></label>
            <label className="campo"><span>Notas</span><input value={nueva.notas} placeholder="Cómo la encontró, qué se hizo" onChange={(e) => setNueva({ ...nueva, notas: e.target.value })} /></label>
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
      <div className="fila">
        {puedeCorregir(perfil, zona, p.creado_por) && <button className="boton" onClick={() => setEditando(true)}><Pencil size={16} /><span>Corregir ficha</span></button>}
        {perfil.rol === "administrador" && <button className="boton peligro" onClick={() => void eliminar()}><Trash2 size={16} /><span>Eliminar</span></button>}
        <Link href={ruta} className="boton secundario">Volver</Link>
      </div>
    </div>
  );
}
