"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Layers,
  User,
  MapPin,
  Home,
  Users,
  Smile,
  Sparkles,
  Award,
  AlertTriangle,
  Edit3,
  Trash2,
  HeartPulse,
  FileText,
  X,
  CheckCircle2,
} from "lucide-react";
import { usePerfil } from "@/components/ContextoPerfil";
import FormularioReporte from "@/components/FormularioReporte";
import { reporteVacio, type DatosReporte } from "@/lib/reporte/validar";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { ETIQUETA_CASO, ETIQUETA_DIFICULTAD, type Dificultad, type TipoCaso } from "@/lib/tipos";

type Reporte = Record<string, string | number | boolean | null> & {
  id: string;
  zona_id: string;
  creado_por: string;
  origen: "app" | "google_forms";
  manzanas_pendientes: boolean;
  zonas: { nombre: string } | null;
  reporte_manzanas: { manzana_id: string; manzanas: { codigo: string } | null }[];
  casos_especiales: { tipo: TipoCaso; descripcion: string; estado: string }[];
};

const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function aDatos(r: Reporte): DatosReporte {
  const tiene = (t: TipoCaso) => r.casos_especiales.some((c) => c.tipo === t);
  return {
    ...reporteVacio(),
    zona_id: r.zona_id,
    origen: r.origen,
    responsable_nombre: texto(r.responsable_nombre),
    coordinador_nombre: texto(r.coordinador_nombre),
    fecha_jornada: texto(r.fecha_jornada),
    direccion: texto(r.direccion),
    hogares_visitados: texto(r.hogares_visitados),
    personas_contactadas: texto(r.personas_contactadas),
    personas_aceptan_visita: texto(r.personas_aceptan_visita),
    nombres_visita: texto(r.nombres_visita),
    resultado_espiritual: texto(r.resultado_espiritual),
    caso_enfermo: tiene("enfermo"),
    caso_sordo: tiene("sordo"),
    caso_consejeria: tiene("consejeria"),
    descripcion_caso: r.casos_especiales[0]?.descripcion ?? "",
    evangelismo_ninos: !!r.evangelismo_ninos,
    ninos_alcanzados: texto(r.ninos_alcanzados),
    receptividad: texto(r.receptividad),
    dificultad: (r.dificultad as Dificultad | null) ?? "",
    dificultad_otra: texto(r.dificultad_otra),
    sugerencias: texto(r.sugerencias),
    manzanas: r.reporte_manzanas.map((m) => m.manzana_id),
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
    const { data } = await crearClienteNavegador()
      .from("reportes")
      .select("*,zonas(nombre),reporte_manzanas(manzana_id,manzanas(codigo)),casos_especiales(tipo,descripcion,estado)")
      .eq("id", id)
      .maybeSingle();
    setR(data as unknown as Reporte | null);
    setCargado(true);
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!cargado) return <p className="tenue">Cargando reporte...</p>;
  if (!r) {
    return (
      <div className="tarjeta pila" style={{ textAlign: "center", padding: 40 }}>
        <p className="aviso" style={{ justifyContent: "center" }}>
          Este reporte no existe o no tiene permiso para verlo.
        </p>
        <div>
          <Link href="/reportes" className="boton secundario">
            <ArrowLeft size={16} /> Volver a reportes
          </Link>
        </div>
      </div>
    );
  }

  const esAdmin = perfil.rol === "administrador";
  const puedeEditar = esAdmin || r.creado_por === perfil.id;

  async function eliminar() {
    if (!window.confirm("¿Eliminar este reporte? Esta acción no se puede deshacer.")) return;
    const { error: fallo } = await crearClienteNavegador().from("reportes").delete().eq("id", id);
    if (fallo) {
      setError("No se pudo eliminar el reporte.");
      return;
    }
    router.push("/reportes");
  }

  if (editando) {
    return (
      <div className="pila">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1>
            <Edit3 size={24} style={{ color: "var(--marca)" }} />
            <span>Editar Reporte</span>
          </h1>
          <button className="boton secundario" onClick={() => setEditando(false)}>
            <X size={16} />
            <span>Cancelar edición</span>
          </button>
        </div>
        <FormularioReporte
          inicial={aDatos(r)}
          reporteId={r.id}
          alGuardar={() => {
            setEditando(false);
            void cargar();
          }}
        />
      </div>
    );
  }

  const dificultad = r.dificultad ? ETIQUETA_DIFICULTAD[r.dificultad as Dificultad] : "-";
  const manzanas = r.reporte_manzanas.map((m) => m.manzanas?.codigo).filter(Boolean);

  return (
    <div className="pila">
      {/* Navegación y Acciones */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link href="/reportes" className="boton secundario" style={{ minHeight: 38, padding: "6px 14px", fontSize: "0.85rem" }}>
          <ArrowLeft size={16} />
          <span>Volver a reportes</span>
        </Link>
        <div className="fila">
          {puedeEditar && (
            <button className="boton" onClick={() => setEditando(true)} style={{ minHeight: 38, padding: "6px 14px", fontSize: "0.85rem" }}>
              <Edit3 size={15} />
              <span>Editar</span>
            </button>
          )}
          {esAdmin && (
            <button className="boton peligro" onClick={() => void eliminar()} style={{ minHeight: 38, padding: "6px 14px", fontSize: "0.85rem" }}>
              <Trash2 size={15} />
              <span>Eliminar</span>
            </button>
          )}
        </div>
      </div>

      {/* Encabezado del Reporte */}
      <div className="tarjeta" style={{ background: "var(--superficie-pura)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span className="badge badge-marca">{r.zonas?.nombre ?? "Zona sin nombre"}</span>
          <span className="badge badge-tenue">
            <Calendar size={13} /> {texto(r.fecha_jornada)}
          </span>
          {r.manzanas_pendientes ? (
            <span className="badge badge-aviso">
              <span className="punto-estado punto-aviso" />
              <span>Pendiente de marcar manzanas</span>
            </span>
          ) : (
            <span className="badge badge-exito">
              <span className="punto-estado punto-exito" />
              <span>Completo</span>
            </span>
          )}
        </div>
        <h1 style={{ fontSize: "1.6rem", marginTop: 4, marginBottom: 8 }}>
          Jornada Evangelística en {r.zonas?.nombre}
        </h1>
        <p className="tenue" style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <span><b>Responsable:</b> {texto(r.responsable_nombre)}</span>
          <span><b>Coordinador:</b> {texto(r.coordinador_nombre)}</span>
          {r.direccion && <span><b>Ubicación:</b> {texto(r.direccion)}</span>}
        </p>
      </div>

      {r.manzanas_pendientes && (
        <div className="aviso" role="alert">
          <AlertTriangle size={20} />
          <span>
            Este reporte aún no tiene manzanas marcadas en el mapa. Presione <b>Editar</b> para seleccionarlas.
          </span>
        </div>
      )}

      {/* Métricas Principales */}
      <div className="rejilla-kpi">
        <div className="kpi">
          <div className="kpi-encabezado">
            <span>Hogares visitados</span>
            <div className="kpi-icono"><Home size={18} /></div>
          </div>
          <b>{texto(r.hogares_visitados) || "0"}</b>
          <span className="tenue">Familias alcanzadas</span>
        </div>

        <div className="kpi">
          <div className="kpi-encabezado">
            <span>Personas contactadas</span>
            <div className="kpi-icono"><Users size={18} /></div>
          </div>
          <b>{texto(r.personas_contactadas) || "0"}</b>
          <span className="tenue">Habladas directamente</span>
        </div>

        <div className="kpi">
          <div className="kpi-encabezado">
            <span>Aceptaron visita</span>
            <div className="kpi-icono"><Smile size={18} /></div>
          </div>
          <b>{texto(r.personas_aceptan_visita) || "0"}</b>
          <span className="tenue">Puertas abiertas</span>
        </div>

        <div className="kpi">
          <div className="kpi-encabezado">
            <span>Niños alcanzados</span>
            <div className="kpi-icono"><Sparkles size={18} /></div>
          </div>
          <b>{r.evangelismo_ninos ? texto(r.ninos_alcanzados) || "0" : "0"}</b>
          <span className="tenue">{r.evangelismo_ninos ? "Evangelismo infantil" : "No se realizó"}</span>
        </div>

        <div className="kpi">
          <div className="kpi-encabezado">
            <span>Receptividad</span>
            <div className="kpi-icono"><Award size={18} /></div>
          </div>
          <b>{texto(r.receptividad) || "-"}/5</b>
          <span className="tenue">Calificación del sector</span>
        </div>
      </div>

      {/* Manzanas Evangelizadas */}
      <div className="tarjeta pila">
        <h2>
          <MapPin size={20} style={{ color: "var(--marca)" }} />
          <span>Manzanas cubiertas en esta jornada</span>
        </h2>
        {manzanas.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {manzanas.map((c) => (
              <span key={c} className="chip-manzana" style={{ padding: "6px 14px", fontSize: "0.9rem" }}>
                <CheckCircle2 size={15} />
                <span>Manzana {c}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="tenue" style={{ fontStyle: "italic" }}>
            No se han registrado manzanas para este reporte.
          </p>
        )}
      </div>

      {/* Resultado Espiritual y Nombres */}
      <div className="tarjeta pila">
        <h2>
          <FileText size={20} style={{ color: "var(--marca)" }} />
          <span>Resultado espiritual y testimonios</span>
        </h2>
        <div style={{ padding: 16, borderRadius: "var(--radio-sm)", background: "var(--superficie-tenue)", border: "1px solid var(--linea)" }}>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {texto(r.resultado_espiritual) || "Sin descripción registrada."}
          </p>
        </div>

        {r.nombres_visita && (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem", display: "block", marginBottom: 6 }}>
              Nombres de contactos para visita:
            </span>
            <div style={{ padding: 12, borderRadius: "var(--radio-sm)", background: "var(--superficie-tenue)", border: "1px solid var(--linea)" }}>
              <p style={{ whiteSpace: "pre-wrap" }}>{texto(r.nombres_visita)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Casos Especiales */}
      {r.casos_especiales.length > 0 && (
        <div className="tarjeta pila">
          <h2>
            <HeartPulse size={20} style={{ color: "var(--peligro)" }} />
            <span>Casos especiales identificados ({r.casos_especiales.length})</span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {r.casos_especiales.map((c) => (
              <div
                key={c.tipo}
                style={{
                  padding: 16,
                  borderRadius: "var(--radio-sm)",
                  border: "1px solid var(--linea)",
                  background: "var(--superficie-pura)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    {ETIQUETA_CASO[c.tipo] ?? c.tipo}
                  </span>
                  <span className={`badge ${c.estado === "atendido" ? "badge-exito" : "badge-aviso"}`}>
                    {c.estado === "atendido" ? "Atendido" : "Pendiente"}
                  </span>
                </div>
                <p className="tenue" style={{ fontSize: "0.88rem" }}>
                  {c.descripcion || "Sin observaciones adicionales."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluación y Dificultades */}
      <div className="tarjeta pila">
        <h2>
          <Award size={20} style={{ color: "var(--marca)" }} />
          <span>Evaluación y sugerencias</span>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <div>
            <span className="tenue" style={{ fontSize: "0.82rem", display: "block" }}>Dificultades encontradas</span>
            <span style={{ fontWeight: 600 }}>{r.dificultad_otra ? `${dificultad}: ${r.dificultad_otra}` : dificultad}</span>
          </div>
          <div>
            <span className="tenue" style={{ fontSize: "0.82rem", display: "block" }}>Sugerencias del equipo</span>
            <span style={{ fontWeight: 600 }}>{texto(r.sugerencias) || "Ninguna registrada"}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="aviso" role="alert" style={{ background: "var(--peligro-fondo)", borderColor: "var(--peligro-borde)", color: "var(--peligro-texto)" }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
