"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import MapaDinamico from "@/components/MapaDinamico";
import { usePerfil } from "@/components/ContextoPerfil";
import { construirCasos, reporteVacio, validarReporte, type DatosReporte, type Errores } from "@/lib/reporte/validar";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { ETIQUETA_DIFICULTAD, type Dificultad, type Manzana, type Zona } from "@/lib/tipos";

type Props = { inicial?: DatosReporte; reporteId?: string; alGuardar: (id: string) => void };

export default function FormularioReporte({ inicial, reporteId, alGuardar }: Props) {
  const perfil = usePerfil();
  const esAdmin = perfil.rol === "administrador";
  const [d, setD] = useState<DatosReporte>(() => inicial ?? {
    ...reporteVacio(), zona_id: perfil.zona_id ?? "",
    responsable_nombre: perfil.nombre_completo, coordinador_nombre: perfil.nombre_completo,
  });
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [manzanas, setManzanas] = useState<Manzana[]>([]);
  const [errores, setErrores] = useState<Errores>({});
  const [falloEnvio, setFalloEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const db = crearClienteNavegador();
    void Promise.all([db.from("zonas").select("*").order("numero"), db.from("manzanas").select("*").order("codigo")]).then(([z, m]) => {
      if (z.error || m.error) { setFalloEnvio("No se pudieron cargar las zonas. Revise su conexión y recargue la página."); return; }
      setZonas(z.data as Zona[]);
      setManzanas(m.data as Manzana[]);
    });
  }, []);

  const poner = <K extends keyof DatosReporte>(c: K, v: DatosReporte[K]) => setD((a) => ({ ...a, [c]: v }));
  const seleccion = useMemo(() => new Set(d.manzanas), [d.manzanas]);
  const manzanasZona = useMemo(() => manzanas.filter((m) => m.zona_id === d.zona_id), [manzanas, d.zona_id]);
  const zonasVisibles = useMemo(() => zonas.filter((z) => z.id === d.zona_id), [zonas, d.zona_id]);
  const sinEstados = useMemo(() => [], []);
  const codigos = manzanas.filter((m) => seleccion.has(m.id)).map((m) => m.codigo);

  const alternar = useMemo(() => (m: Manzana) => setD((a) => ({
    ...a, manzanas: a.manzanas.includes(m.id) ? a.manzanas.filter((x) => x !== m.id) : [...a.manzanas, m.id],
  })), []);

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
        zona_id: d.zona_id, responsable_nombre: d.responsable_nombre.trim(), coordinador_nombre: d.coordinador_nombre.trim(),
        fecha_jornada: d.fecha_jornada, direccion: d.direccion.trim() || null, hogares_visitados: +d.hogares_visitados,
        personas_contactadas: +d.personas_contactadas, personas_aceptan_visita: +d.personas_aceptan_visita,
        nombres_visita: d.nombres_visita.trim() || null, resultado_espiritual: d.resultado_espiritual.trim(),
        evangelismo_ninos: d.evangelismo_ninos, ninos_alcanzados: d.evangelismo_ninos ? +d.ninos_alcanzados : null,
        receptividad: +d.receptividad, dificultad: d.dificultad,
        dificultad_otra: d.dificultad === "otra" ? d.dificultad_otra.trim() : null, sugerencias: d.sugerencias.trim() || null,
      },
      p_manzanas: d.manzanas,
      p_casos: construirCasos(d),
    });
    setEnviando(false);
    if (error) { setFalloEnvio("No se pudo guardar. Revise su conexión e intente de nuevo."); return; }
    alGuardar(data as string);
  }

  const texto = (c: keyof DatosReporte, etiqueta: string, tipo = "text", extra: ReactNode = null) => (
    <Campo etiqueta={etiqueta} error={errores[c]}>
      <input name={c} type={tipo} inputMode={tipo === "number" ? "numeric" : undefined} min={tipo === "number" ? 0 : undefined}
        value={String(d[c])} onChange={(e) => poner(c, e.target.value as never)} />
      {extra}
    </Campo>
  );
  const area = (c: keyof DatosReporte, etiqueta: string) => (
    <Campo etiqueta={etiqueta} error={errores[c]}>
      <textarea name={c} value={String(d[c])} onChange={(e) => poner(c, e.target.value as never)} />
    </Campo>
  );
  const casilla = (c: "caso_enfermo" | "caso_sordo" | "caso_consejeria" | "evangelismo_ninos", etiqueta: string) => (
    <label className="casilla"><input type="checkbox" checked={d[c]} onChange={(e) => poner(c, e.target.checked)} />{etiqueta}</label>
  );

  return (
    <form ref={formulario} className="pila" onSubmit={enviar} noValidate>
      <section className="tarjeta pila">
        <h2>Datos generales</h2>
        {texto("responsable_nombre", "Nombre completo")}
        {esAdmin && !reporteId ? (
          <Campo etiqueta="Zona / Bloque asignado" error={errores.zona_id}>
            <select name="zona_id" value={d.zona_id} onChange={(e) => setD((a) => ({ ...a, zona_id: e.target.value, manzanas: [] }))}>
              <option value="">Elija una zona</option>
              {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </select>
          </Campo>
        ) : <p>Zona: <b>{zonas.find((z) => z.id === d.zona_id)?.nombre ?? "..."}</b></p>}
        {texto("coordinador_nombre", "Nombre del coordinador de zona")}
        {texto("fecha_jornada", "Fecha de la jornada evangelística", "date")}
      </section>

      <section className="tarjeta pila">
        <h2>Cobertura del trabajo</h2>
        <div>
          <p>Toque en el mapa las manzanas trabajadas.</p>
          {d.zona_id ? <MapaDinamico zonas={zonasVisibles} manzanas={manzanasZona} estados={sinEstados} seleccion={seleccion} alTocar={alternar} />
            : <p className="tenue">Primero elija la zona.</p>}
          <p className="tenue" aria-live="polite">{codigos.length ? `Elegidas: ${codigos.join(", ")}` : "Ninguna manzana elegida"}</p>
          {errores.manzanas && <p className="error" role="alert">{errores.manzanas}</p>}
        </div>
        {texto("direccion", "Dirección o referencia (opcional)")}
        {texto("hogares_visitados", "Cantidad de hogares visitados", "number")}
        {texto("personas_contactadas", "Cantidad de personas contactadas", "number")}
        {texto("personas_aceptan_visita", "Personas que aceptaron visita posterior", "number")}
        {area("nombres_visita", "Nombres de quienes aceptaron visita (opcional)")}
        {area("resultado_espiritual", "Breve descripción del resultado espiritual")}
      </section>

      <section className="tarjeta pila">
        <h2>Casos especiales detectados</h2>
        {casilla("caso_enfermo", "Se encontró una persona enferma que requiere visita hospitalaria")}
        {casilla("caso_sordo", "Se identificó una persona sorda")}
        {casilla("caso_consejeria", "Se detectó un caso que requiere consejería o visitación especial")}
        {(d.caso_enfermo || d.caso_sordo || d.caso_consejeria) && area("descripcion_caso", "Describa brevemente el caso")}
      </section>

      <section className="tarjeta pila">
        <h2>Evangelismo infantil</h2>
        {casilla("evangelismo_ninos", "Se realizó evangelismo a niños en la zona")}
        {d.evangelismo_ninos && texto("ninos_alcanzados", "Cantidad aproximada de niños alcanzados", "number")}
      </section>

      <section className="tarjeta pila">
        <h2>Evaluación del trabajo</h2>
        <Campo etiqueta="¿Cómo evalúa la receptividad del sector? (1 baja, 5 alta)" error={errores.receptividad}>
          <select name="receptividad" value={d.receptividad} onChange={(e) => poner("receptividad", e.target.value)}>
            <option value="">Elija</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Dificultades encontradas durante la jornada" error={errores.dificultad}>
          <select name="dificultad" value={d.dificultad} onChange={(e) => poner("dificultad", e.target.value as Dificultad | "")}>
            <option value="">Elija</option>
            {Object.entries(ETIQUETA_DIFICULTAD).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </Campo>
        {d.dificultad === "otra" && texto("dificultad_otra", "Describa la dificultad")}
        {area("sugerencias", "Sugerencias para mejorar el trabajo en esta zona (opcional)")}
      </section>

      {falloEnvio && <p className="aviso" role="alert">{falloEnvio}</p>}
      <button className="boton" disabled={enviando}>{enviando ? "Guardando..." : "Guardar reporte"}</button>
    </form>
  );
}

function Campo({ etiqueta, error, children }: { etiqueta: string; error?: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
      {error && <span className="error" role="alert">{error}</span>}
    </label>
  );
}
