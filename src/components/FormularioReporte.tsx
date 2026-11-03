"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  UserCheck,
  MapPin,
  HeartPulse,
  Sparkles,
  Award,
  Save,
  Loader2,
  Calendar,
  Home,
  Users,
  Smile,
  FileText,
  AlertCircle,
  X,
  Layers,
  HelpCircle,
} from "lucide-react";
import MapaDinamico from "@/components/MapaDinamico";
import { usePerfil } from "@/components/ContextoPerfil";
import { construirCasos, reporteVacio, validarReporte, type DatosReporte, type Errores } from "@/lib/reporte/validar";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { ETIQUETA_DIFICULTAD, type Dificultad, type Manzana, type Zona } from "@/lib/tipos";

type Props = { inicial?: DatosReporte; reporteId?: string; alGuardar: (id: string) => void };

export default function FormularioReporte({ inicial, reporteId, alGuardar }: Props) {
  const perfil = usePerfil();
  const eligeZona = perfil.rol !== "coordinador";
  const [d, setD] = useState<DatosReporte>(() => inicial ?? {
    ...reporteVacio(),
    zona_id: perfil.zona_id ?? "",
    responsable_nombre: perfil.rol === "usuario" ? "" : perfil.nombre_completo,
    coordinador_nombre: perfil.rol === "usuario" ? "" : perfil.nombre_completo,
  });
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [manzanas, setManzanas] = useState<Manzana[]>([]);
  const [errores, setErrores] = useState<Errores>({});
  const [falloEnvio, setFalloEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const db = crearClienteNavegador();
    void Promise.all([
      db.from("zonas").select("*").order("numero"),
      db.from("manzanas").select("*").order("codigo"),
    ]).then(([z, m]) => {
      if (z.error || m.error) {
        setFalloEnvio("No se pudieron cargar las zonas. Revise su conexión y recargue la página.");
        return;
      }
      setZonas(z.data as Zona[]);
      setManzanas(m.data as Manzana[]);
    });
  }, []);

  const poner = <K extends keyof DatosReporte>(c: K, v: DatosReporte[K]) => setD((a) => ({ ...a, [c]: v }));
  const seleccion = useMemo(() => new Set(d.manzanas), [d.manzanas]);
  const manzanasZona = useMemo(() => manzanas.filter((m) => m.zona_id === d.zona_id), [manzanas, d.zona_id]);
  const zonasVisibles = useMemo(() => zonas.filter((z) => z.id === d.zona_id), [zonas, d.zona_id]);
  const sinEstados = useMemo(() => [], []);
  
  const manzanasElegidas = useMemo(
    () => manzanas.filter((m) => seleccion.has(m.id)),
    [manzanas, seleccion]
  );

  const alternar = useMemo(
    () => (m: Manzana) =>
      setD((a) => ({
        ...a,
        manzanas: a.manzanas.includes(m.id) ? a.manzanas.filter((x) => x !== m.id) : [...a.manzanas, m.id],
      })),
    []
  );

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const encontrados = validarReporte(d);
    setErrores(encontrados);
    setFalloEnvio("");
    const primero = Object.keys(encontrados)[0];
    if (primero) {
      formulario.current?.querySelector<HTMLElement>(`[name="${primero}"]`)?.focus();
      return;
    }
    setEnviando(true);
    const { data, error } = await crearClienteNavegador().rpc("guardar_reporte", {
      p_id: reporteId ?? null,
      p_reporte: {
        zona_id: d.zona_id,
        responsable_nombre: d.responsable_nombre.trim(),
        coordinador_nombre: d.coordinador_nombre.trim(),
        fecha_jornada: d.fecha_jornada,
        direccion: d.direccion.trim() || null,
        hogares_visitados: +d.hogares_visitados,
        personas_contactadas: +d.personas_contactadas,
        personas_aceptan_visita: +d.personas_aceptan_visita,
        nombres_visita: d.nombres_visita.trim() || null,
        resultado_espiritual: d.resultado_espiritual.trim(),
        evangelismo_ninos: d.evangelismo_ninos,
        ninos_alcanzados: d.evangelismo_ninos ? +d.ninos_alcanzados : null,
        receptividad: +d.receptividad,
        dificultad: d.dificultad,
        dificultad_otra: d.dificultad === "otra" ? d.dificultad_otra.trim() : null,
        sugerencias: d.sugerencias.trim() || null,
      },
      p_manzanas: d.manzanas,
      p_casos: construirCasos(d),
    });
    setEnviando(false);
    if (error) {
      setFalloEnvio("No se pudo guardar el reporte. Revise su conexión e intente de nuevo.");
      return;
    }
    alGuardar(data as string);
  }

  const texto = (
    c: keyof DatosReporte,
    etiqueta: string,
    tipo = "text",
    icono?: ReactNode,
    placeholder?: string
  ) => (
    <Campo etiqueta={etiqueta} error={errores[c]} icono={icono}>
      <input
        name={c}
        type={tipo}
        inputMode={tipo === "number" ? "numeric" : undefined}
        min={tipo === "number" ? 0 : undefined}
        placeholder={placeholder}
        value={String(d[c])}
        onChange={(e) => poner(c, e.target.value as never)}
      />
    </Campo>
  );

  const area = (
    c: keyof DatosReporte,
    etiqueta: string,
    icono?: ReactNode,
    placeholder?: string
  ) => (
    <Campo etiqueta={etiqueta} error={errores[c]} icono={icono}>
      <textarea
        name={c}
        placeholder={placeholder}
        value={String(d[c])}
        onChange={(e) => poner(c, e.target.value as never)}
      />
    </Campo>
  );

  const zonaActual = zonas.find((z) => z.id === d.zona_id);

  return (
    <form ref={formulario} className="pila" onSubmit={enviar} noValidate>
      {/* 1. DATOS GENERALES */}
      <section className="tarjeta pila">
        <h2>
          <UserCheck size={22} style={{ color: "var(--marca)" }} />
          <span>Datos generales de la jornada</span>
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {texto("responsable_nombre", "Nombre del responsable", "text", <UserCheck size={16} />, "Ej: Juan Pérez")}

          {eligeZona && !reporteId ? (
            <Campo etiqueta="Zona / Bloque asignado" error={errores.zona_id} icono={<Layers size={16} />}>
              <select
                name="zona_id"
                value={d.zona_id}
                onChange={(e) => setD((a) => ({ ...a, zona_id: e.target.value, manzanas: [] }))}
              >
                <option value="">Seleccione una zona...</option>
                {zonas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          ) : (
            <div className="campo">
              <span><Layers size={16} /> Zona asignada</span>
              <div
                style={{
                  minHeight: 46,
                  padding: "10px 14px",
                  borderRadius: "var(--radio-sm)",
                  background: "var(--superficie-tenue)",
                  border: "1px solid var(--linea)",
                  display: "flex",
                  alignItems: "center",
                  fontWeight: 600,
                  color: "var(--marca)",
                }}
              >
                {zonaActual?.nombre ?? "Cargando zona..."}
              </div>
            </div>
          )}

          {texto("coordinador_nombre", "Nombre del coordinador de zona", "text", <UserCheck size={16} />)}
          {texto("fecha_jornada", "Fecha de la jornada", "date", <Calendar size={16} />)}
        </div>
      </section>

      {/* 2. COBERTURA DEL TRABAJO */}
      <section className="tarjeta pila">
        <div>
          <h2>
            <MapPin size={22} style={{ color: "var(--marca)" }} />
            <span>Cobertura del trabajo y selección cartográfica</span>
          </h2>
          <p className="tenue" style={{ marginTop: 4 }}>
            Haga clic o toque en el mapa las manzanas correspondientes que fueron evangelizadas en esta jornada.
          </p>
        </div>

        {d.zona_id ? (
          <div>
            <MapaDinamico
              zonas={zonasVisibles}
              manzanas={manzanasZona}
              estados={sinEstados}
              seleccion={seleccion}
              alTocar={alternar}
            />
          </div>
        ) : (
          <div className="aviso">
            <AlertCircle size={18} />
            <span>Primero elija una zona para cargar sus manzanas en el mapa.</span>
          </div>
        )}

        {/* Chips de Manzanas Elegidas */}
        <div>
          <span style={{ fontSize: "0.86rem", fontWeight: 600, display: "block", marginBottom: 8 }}>
            Manzanas seleccionadas ({manzanasElegidas.length}):
          </span>
          {manzanasElegidas.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {manzanasElegidas.map((m) => (
                <span key={m.id} className="chip-manzana">
                  <span>{m.codigo}</span>
                  <button type="button" onClick={() => alternar(m)} title="Quitar manzana">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="tenue" style={{ fontStyle: "italic" }}>
              Ninguna manzana seleccionada en el mapa aún.
            </p>
          )}
          {errores.manzanas && (
            <p className="error" role="alert">
              <AlertCircle size={16} /> {errores.manzanas}
            </p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {texto("direccion", "Dirección o referencia del sector (opcional)", "text", <MapPin size={16} />, "Ej: Calle 16 con Cra 20")}
          {texto("hogares_visitados", "Cantidad de hogares visitados", "number", <Home size={16} />)}
          {texto("personas_contactadas", "Cantidad de personas contactadas", "number", <Users size={16} />)}
          {texto("personas_aceptan_visita", "Personas que aceptaron visita posterior", "number", <Smile size={16} />)}
        </div>

        {area("nombres_visita", "Nombres de quienes aceptaron visita (opcional)", <FileText size={16} />, "Escriba nombres y teléfonos o direcciones de contacto")}
        {area("resultado_espiritual", "Breve descripción del resultado espiritual", <FileText size={16} />, "Describa testimonios, oraciones realizadas o decisiones tomadas")}
      </section>

      {/* 3. CASOS ESPECIALES DETECTADOS */}
      <section className="tarjeta pila">
        <div>
          <h2>
            <HeartPulse size={22} style={{ color: "var(--peligro)" }} />
            <span>Casos especiales detectados</span>
          </h2>
          <p className="tenue" style={{ marginTop: 4 }}>
            Marque las situaciones identificadas que requieren atención, visitación pastoral o consejería.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <label className={`casilla ${d.caso_enfermo ? "casilla-activa" : ""}`}>
            <input
              type="checkbox"
              checked={d.caso_enfermo}
              onChange={(e) => poner("caso_enfermo", e.target.checked)}
            />
            <div>
              <span style={{ fontWeight: 600, display: "block" }}>Persona enferma</span>
              <span className="tenue">Requiere visita hospitalaria u oración en casa</span>
            </div>
          </label>

          <label className={`casilla ${d.caso_sordo ? "casilla-activa" : ""}`}>
            <input
              type="checkbox"
              checked={d.caso_sordo}
              onChange={(e) => poner("caso_sordo", e.target.checked)}
            />
            <div>
              <span style={{ fontWeight: 600, display: "block" }}>Persona sorda</span>
              <span className="tenue">Para enlace con ministerio de lengua de señas</span>
            </div>
          </label>

          <label className={`casilla ${d.caso_consejeria ? "casilla-activa" : ""}`}>
            <input
              type="checkbox"
              checked={d.caso_consejeria}
              onChange={(e) => poner("caso_consejeria", e.target.checked)}
            />
            <div>
              <span style={{ fontWeight: 600, display: "block" }}>Consejería o caso especial</span>
              <span className="tenue">Requiere seguimiento pastoral detallado</span>
            </div>
          </label>
        </div>

        {(d.caso_enfermo || d.caso_sordo || d.caso_consejeria) &&
          area("descripcion_caso", "Describa brevemente el caso o detalles para el seguimiento", <HeartPulse size={16} />)}
      </section>

      {/* 4. EVANGELISMO INFANTIL */}
      <section className="tarjeta pila">
        <div>
          <h2>
            <Sparkles size={22} style={{ color: "#8b5cf6" }} />
            <span>Evangelismo infantil</span>
          </h2>
        </div>

        <label className={`casilla ${d.evangelismo_ninos ? "casilla-activa" : ""}`}>
          <input
            type="checkbox"
            checked={d.evangelismo_ninos}
            onChange={(e) => poner("evangelismo_ninos", e.target.checked)}
          />
          <div>
            <span style={{ fontWeight: 600, display: "block" }}>
              ¿Se realizó evangelismo a niños en la zona?
            </span>
            <span className="tenue">Actividad infantil, rondas, lecciones bíblicas para niños</span>
          </div>
        </label>

        {d.evangelismo_ninos &&
          texto("ninos_alcanzados", "Cantidad aproximada de niños alcanzados", "number", <Sparkles size={16} />)}
      </section>

      {/* 5. EVALUACIÓN DEL TRABAJO */}
      <section className="tarjeta pila">
        <div>
          <h2>
            <Award size={22} style={{ color: "var(--marca)" }} />
            <span>Evaluación del trabajo</span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Campo
            etiqueta="¿Cómo evalúa la receptividad del sector? (1 baja, 5 alta)"
            error={errores.receptividad}
            icono={<StarRating />}
          >
            <select
              name="receptividad"
              value={d.receptividad}
              onChange={(e) => poner("receptividad", e.target.value)}
            >
              <option value="">Seleccione calificación...</option>
              <option value="1">1 - Muy baja (Puertas cerradas, rechazo)</option>
              <option value="2">2 - Baja</option>
              <option value="3">3 - Moderada</option>
              <option value="4">4 - Buena receptividad</option>
              <option value="5">5 - Excelente receptividad (Muy abiertos a la Palabra)</option>
            </select>
          </Campo>

          <Campo
            etiqueta="Dificultades encontradas durante la jornada"
            error={errores.dificultad}
            icono={<HelpCircle size={16} />}
          >
            <select
              name="dificultad"
              value={d.dificultad}
              onChange={(e) => poner("dificultad", e.target.value as Dificultad | "")}
            >
              <option value="">Seleccione...</option>
              {Object.entries(ETIQUETA_DIFICULTAD).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        {d.dificultad === "otra" &&
          texto("dificultad_otra", "Describa la dificultad encontrada", "text", <HelpCircle size={16} />)}

        {area("sugerencias", "Sugerencias para mejorar el trabajo en esta zona (opcional)", <FileText size={16} />)}
      </section>

      {/* Fallo si ocurre */}
      {falloEnvio && (
        <div className="aviso" style={{ background: "var(--peligro-fondo)", borderColor: "var(--peligro-borde)", color: "var(--peligro-texto)" }} role="alert">
          <AlertCircle size={20} />
          <span>{falloEnvio}</span>
        </div>
      )}

      {/* BARRA FLOTANTE DE ACCIÓN */}
      <div className="barra-flotante-accion">
        <div>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", display: "block" }}>
            {manzanasElegidas.length > 0 ? `${manzanasElegidas.length} manzanas marcadas` : "Reporte listo para guardar"}
          </span>
          <span className="tenue" style={{ fontSize: "0.8rem" }}>
            {d.fecha_jornada ? `Fecha: ${d.fecha_jornada}` : "Complete los datos solicitados"}
          </span>
        </div>
        <button className="boton" disabled={enviando} style={{ minWidth: 170 }}>
          {enviando ? (
            <>
              <Loader2 size={18} className="girar" />
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>Guardar reporte</span>
            </>
          )}
        </button>
      </div>

      <style jsx>{`
        .girar {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
}

function StarRating() {
  return <Award size={16} style={{ color: "#f59e0b" }} />;
}

function Campo({
  etiqueta,
  error,
  icono,
  children,
}: {
  etiqueta: string;
  error?: string;
  icono?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="campo">
      <span>
        {icono}
        {etiqueta}
      </span>
      {children}
      {error && (
        <span className="error" role="alert">
          <AlertCircle size={14} />
          {error}
        </span>
      )}
    </label>
  );
}
