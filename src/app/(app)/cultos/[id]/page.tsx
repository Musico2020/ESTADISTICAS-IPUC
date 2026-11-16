"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Home, Pencil, Trash2 } from "lucide-react";
import { usePerfil } from "@/components/ContextoPerfil";
import FormularioCulto from "@/components/FormularioCulto";
import MapaPuntosDinamico from "@/components/MapaPuntosDinamico";
import { DIAS, formatoPesos, type DatosCulto } from "@/lib/culto/validar";
import { puedeCorregir } from "@/lib/roles";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Zona } from "@/lib/tipos";

type Culto = {
  id: string; zona_id: string; creado_por: string; fecha: string; dia_semana: number; direccion: string; lat: number; lon: number;
  precision_m: number | null; hermanos: number; amigos: number; ninos: number; ofrenda: number;
  hubo_enfermos: boolean; se_oro_enfermos: boolean; observaciones: string | null;
};

const aDatos = (c: Culto): DatosCulto => ({
  zona_id: c.zona_id, fecha: c.fecha, direccion: c.direccion, lat: c.lat, lon: c.lon, precision_m: c.precision_m,
  hermanos: String(c.hermanos), amigos: String(c.amigos), ninos: String(c.ninos), ofrenda: String(c.ofrenda),
  hubo_enfermos: c.hubo_enfermos, se_oro_enfermos: c.se_oro_enfermos, observaciones: c.observaciones ?? "",
});

export default function DetalleCulto() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const perfil = usePerfil();
  const [c, setC] = useState<Culto | null>(null);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [cargado, setCargado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const db = crearClienteNavegador();
    const [r, z] = await Promise.all([db.from("cultos").select("*").eq("id", id).maybeSingle(), db.from("zonas").select("*").order("numero")]);
    setC(r.data as Culto | null);
    setZonas((z.data ?? []) as Zona[]);
    setCargado(true);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void cargar();
  }, [cargar]);

  const zona = useMemo(() => zonas.find((z) => z.id === c?.zona_id), [zonas, c]);
  const marcador = useMemo(() => (c ? { lat: c.lat, lon: c.lon } : null), [c]);
  const soloZona = useMemo(() => (zona ? [zona] : []), [zona]);

  if (!cargado) return <p className="tenue">Cargando...</p>;
  if (!c) return <p className="aviso">Este culto no existe o no tiene permiso para verlo.</p>;

  async function eliminar() {
    if (!window.confirm("¿Eliminar este culto? Esta acción no se puede deshacer.")) return;
    const { error: fallo } = await crearClienteNavegador().from("cultos").delete().eq("id", id);
    if (fallo) { setError("No se pudo eliminar el culto."); return; }
    router.push("/cultos");
  }

  if (editando) {
    return (
      <div className="pila">
        <h1><Pencil size={26} /><span>Corregir culto</span></h1>
        <FormularioCulto inicial={aDatos(c)} cultoId={c.id} alGuardar={() => { setEditando(false); void cargar(); }} />
        <button className="boton secundario" onClick={() => setEditando(false)}>Cancelar</button>
      </div>
    );
  }

  const filas: [string, string | number][] = [
    ["Fecha", `${DIAS[c.dia_semana]} ${c.fecha}`], ["Zona", zona?.nombre ?? ""], ["Dirección", c.direccion],
    ["Hermanos", c.hermanos], ["Amigos", c.amigos], ["Niños", c.ninos], ["Ofrenda", formatoPesos(c.ofrenda)],
    ["Enfermos", c.hubo_enfermos ? (c.se_oro_enfermos ? "Sí, se oró por ellos" : "Sí") : "No"],
    ["Ubicación", `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}${c.precision_m ? ` (±${c.precision_m} m)` : ""}`],
    ["Observaciones", c.observaciones ?? "-"],
  ];

  return (
    <div className="pila">
      <h1><Home size={28} style={{ color: "var(--marca)" }} /><span>Culto del {DIAS[c.dia_semana].toLowerCase()} {c.fecha}</span></h1>
      <MapaPuntosDinamico zonas={soloZona} marcador={marcador} />
      <div className="tarjeta tabla-envoltura">
        <table><tbody>{filas.map(([e, v]) => <tr key={e}><th scope="row">{e}</th><td>{v}</td></tr>)}</tbody></table>
      </div>
      {error && <p className="aviso" role="alert">{error}</p>}
      <div className="fila">
        {puedeCorregir(perfil, zona, c.creado_por) && <button className="boton" onClick={() => setEditando(true)}><Pencil size={16} /><span>Corregir</span></button>}
        {perfil.rol === "administrador" && <button className="boton peligro" onClick={() => void eliminar()}><Trash2 size={16} /><span>Eliminar</span></button>}
        <Link href={`/amigos/nuevo?culto=${c.id}`} className="boton secundario" data-seccion="amigos">Registrar amigo de este culto</Link>
        <Link href={`/vis/nuevo?culto=${c.id}`} className="boton secundario" data-seccion="vis">Registrar hogar de este culto</Link>
        <Link href="/cultos" className="boton secundario">Volver a cultos</Link>
      </div>
    </div>
  );
}
