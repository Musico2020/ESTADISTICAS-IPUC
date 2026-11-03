"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePerfil } from "@/components/ContextoPerfil";
import FormularioReporte from "@/components/FormularioReporte";
import { reporteVacio, type DatosReporte } from "@/lib/reporte/validar";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { ETIQUETA_CASO, ETIQUETA_DIFICULTAD, type Dificultad, type TipoCaso } from "@/lib/tipos";

type Reporte = Record<string, string | number | boolean | null> & {
  id: string; zona_id: string; creado_por: string; origen: "app" | "google_forms"; manzanas_pendientes: boolean;
  zonas: { nombre: string } | null;
  reporte_manzanas: { manzana_id: string; manzanas: { codigo: string } | null }[];
  casos_especiales: { tipo: TipoCaso; descripcion: string; estado: string }[];
};

const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function aDatos(r: Reporte): DatosReporte {
  const tiene = (t: TipoCaso) => r.casos_especiales.some((c) => c.tipo === t);
  return {
    ...reporteVacio(), zona_id: r.zona_id, origen: r.origen,
    responsable_nombre: texto(r.responsable_nombre), coordinador_nombre: texto(r.coordinador_nombre),
    fecha_jornada: texto(r.fecha_jornada), direccion: texto(r.direccion), hogares_visitados: texto(r.hogares_visitados),
    personas_contactadas: texto(r.personas_contactadas), personas_aceptan_visita: texto(r.personas_aceptan_visita),
    nombres_visita: texto(r.nombres_visita), resultado_espiritual: texto(r.resultado_espiritual),
    caso_enfermo: tiene("enfermo"), caso_sordo: tiene("sordo"), caso_consejeria: tiene("consejeria"),
    descripcion_caso: r.casos_especiales[0]?.descripcion ?? "", evangelismo_ninos: !!r.evangelismo_ninos,
    ninos_alcanzados: texto(r.ninos_alcanzados), receptividad: texto(r.receptividad),
    dificultad: (r.dificultad as Dificultad | null) ?? "", dificultad_otra: texto(r.dificultad_otra),
    sugerencias: texto(r.sugerencias), manzanas: r.reporte_manzanas.map((m) => m.manzana_id),
  };
}

export default function DetalleReporte() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const perfil = usePerfil();
  const [r, setR] = useState<Reporte | null>(null);
  const [cargado, setCargado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const { data } = await crearClienteNavegador().from("reportes")
      .select("*,zonas(nombre),reporte_manzanas(manzana_id,manzanas(codigo)),casos_especiales(tipo,descripcion,estado)")
      .eq("id", id).maybeSingle();
    setR(data as unknown as Reporte | null);
    setCargado(true);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del reporte
    void cargar();
  }, [cargar]);

  if (!cargado) return <p className="tenue">Cargando...</p>;
  if (!r) return <p className="aviso">Este reporte no existe o no tiene permiso para verlo.</p>;

  const esAdmin = perfil.rol === "administrador";
  const puedeEditar = esAdmin || r.creado_por === perfil.id;

  async function eliminar() {
    if (!window.confirm("¿Eliminar este reporte? Esta acción no se puede deshacer.")) return;
    const { error: fallo } = await crearClienteNavegador().from("reportes").delete().eq("id", id);
    if (fallo) { setError("No se pudo eliminar el reporte."); return; }
    router.push("/reportes");
  }

  if (editando) {
    return (
      <div className="pila">
        <h1>Editar reporte</h1>
        <FormularioReporte inicial={aDatos(r)} reporteId={r.id} alGuardar={() => { setEditando(false); void cargar(); }} />
        <button className="boton secundario" onClick={() => setEditando(false)}>Cancelar</button>
      </div>
    );
  }

  const dificultad = r.dificultad ? ETIQUETA_DIFICULTAD[r.dificultad as Dificultad] : "-";
  const filas: [string, unknown][] = [
    ["Zona", r.zonas?.nombre], ["Fecha", r.fecha_jornada], ["Responsable", r.responsable_nombre], ["Coordinador", r.coordinador_nombre],
    ["Dirección o referencia", r.direccion], ["Hogares visitados", r.hogares_visitados], ["Personas contactadas", r.personas_contactadas],
    ["Aceptaron visita", r.personas_aceptan_visita], ["Nombres para visita", r.nombres_visita], ["Resultado espiritual", r.resultado_espiritual],
    ["Niños alcanzados", r.evangelismo_ninos ? r.ninos_alcanzados : "No se hizo"], ["Receptividad", r.receptividad],
    ["Dificultad", r.dificultad_otra ? `${dificultad}: ${r.dificultad_otra}` : dificultad], ["Sugerencias", r.sugerencias],
  ];

  return (
    <div className="pila">
      <h1>Reporte del {texto(r.fecha_jornada)}</h1>
      {r.manzanas_pendientes && <p className="aviso">Este reporte importado aún no tiene manzanas marcadas y no aparece en el mapa. Edítelo para marcarlas.</p>}
      <div className="tarjeta tabla-envoltura">
        <table><tbody>
          {filas.map(([e, v]) => <tr key={e}><th scope="row">{e}</th><td>{texto(v) || "-"}</td></tr>)}
          <tr><th scope="row">Manzanas</th><td>{r.reporte_manzanas.map((m) => m.manzanas?.codigo).join(", ") || "-"}</td></tr>
        </tbody></table>
      </div>
      {r.casos_especiales.length > 0 && (
        <div className="tarjeta pila">
          <h2>Casos especiales</h2>
          {r.casos_especiales.map((c) => <p key={c.tipo}><b>{ETIQUETA_CASO[c.tipo]} ({c.estado})</b>: {c.descripcion}</p>)}
        </div>
      )}
      {error && <p className="aviso" role="alert">{error}</p>}
      <div className="fila">
        {puedeEditar && <button className="boton" onClick={() => setEditando(true)}>Editar</button>}
        {esAdmin && <button className="boton peligro" onClick={() => void eliminar()}>Eliminar</button>}
      </div>
    </div>
  );
}
