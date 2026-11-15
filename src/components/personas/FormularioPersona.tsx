"use client";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Crosshair, Save, AlertCircle, ShieldCheck, User, Phone, MapPin, Layers, HeartPulse, HandHeart } from "lucide-react";
import MapaPuntosDinamico from "@/components/MapaPuntosDinamico";
import { usePerfil } from "@/components/ContextoPerfil";
import { useGps } from "@/lib/gps";
import { zonaDePunto } from "@/lib/mapa/zonaDePunto";
import { aFilaPersona, ETIQUETA_ESTADO, personaVacia, validarPersona, type DatosPersona, type ErroresPersona, type EstadoSeguimiento, type TipoPersona } from "@/lib/persona/validar";
import { eligeZona, zonasPermitidas } from "@/lib/roles";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Sector, Zona } from "@/lib/tipos";

const REVISE = "Revise los campos marcados.";

type Props = { tipo: TipoPersona; inicial?: DatosPersona; personaId?: string; cultoId?: string | null; alGuardar: (id: string) => void };

export default function FormularioPersona({ tipo, inicial, personaId, cultoId = null, alGuardar }: Props) {
  const perfil = usePerfil();
  const nino = tipo === "nino_vis";
  const puedeElegir = eligeZona(perfil);
  const [d, setD] = useState<DatosPersona>(() => inicial ?? personaVacia(tipo, perfil.zona_id ?? "", cultoId));
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [errores, setErrores] = useState<ErroresPersona>({});
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const gps = useGps();

  useEffect(() => {
    const db = crearClienteNavegador();
    void Promise.all([db.from("zonas").select("*").order("numero"), db.from("sectores").select("*").order("numero")]).then(([z, s]) => {
      if (z.error || s.error) { setAviso("No se pudieron cargar las zonas. Revise su conexión y recargue la página."); return; }
      setZonas(z.data as Zona[]);
      setSectores(s.data as Sector[]);
    });
  }, []);

  const permitidas = useMemo(() => zonasPermitidas(perfil, zonas), [perfil, zonas]);
  const marcador = useMemo(() => (d.lat !== null && d.lon !== null ? { lat: d.lat, lon: d.lon } : null), [d.lat, d.lon]);
  const quitarError = (c: keyof DatosPersona) => {
    setErrores((e) => (e[c] ? { ...e, [c]: undefined } : e));
    setAviso((a) => (a === REVISE ? "" : a));
  };
  const poner = <K extends keyof DatosPersona>(c: K, v: DatosPersona[K]) => { setD((a) => ({ ...a, [c]: v })); quitarError(c); };

  function ubicar(lat: number, lon: number) {
    const zona = zonaDePunto(permitidas, lat, lon);
    setD((a) => ({ ...a, lat, lon, zona_id: puedeElegir && zona ? zona.id : a.zona_id }));
    quitarError("zona_id");
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const encontrados = validarPersona(d);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) { setAviso(REVISE); return; }
    setAviso("");
    setEnviando(true);
    const db = crearClienteNavegador();
    const fila = aFilaPersona(d);
    const r = personaId
      ? await db.from("personas").update(fila).eq("id", personaId).select("id").single()
      : await db.from("personas").insert(fila).select("id").single();
    setEnviando(false);
    if (r.error || !r.data) { setAviso("No se pudo guardar. Revise su conexión e intente de nuevo; lo escrito no se ha perdido."); return; }
    alGuardar(r.data.id);
  }

  const texto = (c: keyof DatosPersona, etiqueta: string, extra: { icono?: ReactNode; tipo?: string; ayuda?: string } = {}) => (
    <Campo etiqueta={etiqueta} error={errores[c]} icono={extra.icono}>
      <input name={c} type={extra.tipo ?? "text"} inputMode={extra.tipo === "tel" ? "tel" : c === "edad" ? "numeric" : undefined}
        placeholder={extra.ayuda} value={String(d[c] ?? "")} onChange={(e) => poner(c, e.target.value as never)} />
    </Campo>
  );
  const area = (c: keyof DatosPersona, etiqueta: string, ayuda?: string) => (
    <Campo etiqueta={etiqueta} error={errores[c]}>
      <textarea name={c} placeholder={ayuda} value={String(d[c] ?? "")} onChange={(e) => poner(c, e.target.value as never)} />
    </Campo>
  );
  const casilla = (c: "enfermo" | "pide_oracion" | "entrego_vida", etiqueta: string) => (
    <label className={`casilla ${d[c] ? "casilla-activa" : ""}`}>
      <input type="checkbox" checked={d[c]} onChange={(e) => poner(c, e.target.checked)} /><span>{etiqueta}</span>
    </label>
  );

  return (
    <form className="pila" onSubmit={enviar} noValidate>
      <section className="tarjeta pila">
        <h2><User size={22} style={{ color: "var(--marca)" }} /><span>{nino ? "Datos del niño" : "Datos del amigo"}</span></h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {texto("nombre", nino ? "Nombre completo del niño" : "Nombre completo", { icono: <User size={16} /> })}
          {texto("edad", nino ? "Edad (años)" : "Edad (opcional)")}
          {texto("telefono", nino ? "Teléfono del acudiente" : "Teléfono (opcional)", { icono: <Phone size={16} />, tipo: "tel", ayuda: "Ej: 300 123 4567" })}
          {puedeElegir ? (
            <Campo etiqueta="Zona" error={errores.zona_id} icono={<Layers size={16} />}>
              <select name="zona_id" value={d.zona_id} onChange={(e) => poner("zona_id", e.target.value)}>
                <option value="">Seleccione una zona...</option>
                {permitidas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
            </Campo>
          ) : <div className="campo"><span><Layers size={16} /> Zona</span><b>{zonas.find((z) => z.id === d.zona_id)?.nombre ?? "..."}</b></div>}
        </div>
        {nino && texto("acudiente", "Acudiente (nombre y parentesco)", { ayuda: "Ej: Marta Gómez, madre" })}
        {area("familia", nino ? "Familia (con quién vive, hermanos)" : "Familia (opcional)")}
      </section>

      <section className="tarjeta pila">
        <h2><MapPin size={22} style={{ color: "var(--marca)" }} /><span>Ubicación</span></h2>
        {texto("direccion", "Dirección", { ayuda: "Ej: Calle 17 # 20-15" })}
        <button type="button" className="boton secundario" onClick={() => gps.pedir((p) => ubicar(p.lat, p.lon))} disabled={gps.buscando}>
          <Crosshair size={18} /><span>{gps.buscando ? "Buscando ubicación..." : "Usar mi ubicación (opcional)"}</span>
        </button>
        {gps.error && <span className="error" role="alert">{gps.error}</span>}
        <MapaPuntosDinamico zonas={zonas} sectores={sectores} marcador={marcador} alElegir={ubicar} />
        <p className="tenue" style={{ margin: 0, fontSize: "0.85rem" }}>
          {marcador ? `Ubicación: ${marcador.lat.toFixed(6)}, ${marcador.lon.toFixed(6)}` : "Sin ubicación. Puede tocar el mapa para marcar la casa."}
        </p>
      </section>

      <section className="tarjeta pila">
        <h2><HeartPulse size={22} style={{ color: "var(--marca)" }} /><span>Necesidades y oración</span></h2>
        {area("calamidad", nino ? "Calamidad o necesidad" : "Necesidad (opcional)", "Ej: perdió la casa en la creciente, falta de alimentos")}
        {casilla("enfermo", nino ? "El niño está enfermo" : "Está enfermo")}
        {casilla("pide_oracion", "Pide oración")}
        {d.pide_oracion && area("peticion", "Petición de oración")}
      </section>

      <section className="tarjeta pila">
        <h2><HandHeart size={22} style={{ color: "var(--marca)" }} /><span>Seguimiento</span></h2>
        {casilla("entrego_vida", "Se entregó a Cristo")}
        <Campo etiqueta="Estado del seguimiento">
          <select name="estado_seguimiento" value={d.estado_seguimiento} onChange={(e) => poner("estado_seguimiento", e.target.value as EstadoSeguimiento)}>
            {Object.entries(ETIQUETA_ESTADO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </Campo>
        {area("notas", "Notas (opcional)")}
      </section>

      {nino && (
        <section className="tarjeta pila" style={{ borderLeft: "4px solid var(--aviso)" }}>
          <h2><ShieldCheck size={22} /><span>Autorización del acudiente</span></h2>
          <label className={`casilla ${d.autorizacion_acudiente ? "casilla-activa" : ""}`}>
            <input name="autorizacion_acudiente" type="checkbox" checked={d.autorizacion_acudiente} onChange={(e) => poner("autorizacion_acudiente", e.target.checked)} />
            <span>El acudiente autorizó que la iglesia guarde estos datos del niño para su acompañamiento espiritual y social (Ley 1581 de 2012).</span>
          </label>
          {errores.autorizacion_acudiente && <span className="error" role="alert">{errores.autorizacion_acudiente}</span>}
        </section>
      )}

      {aviso && <p className="aviso" role="alert"><AlertCircle size={18} /><span>{aviso}</span></p>}
      <button className="boton" disabled={enviando}><Save size={18} /><span>{enviando ? "Guardando..." : "Guardar ficha"}</span></button>
    </form>
  );
}

function Campo({ etiqueta, error, icono, children }: { etiqueta: string; error?: string; icono?: ReactNode; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{icono} {etiqueta}</span>
      {children}
      {error && <span className="error" role="alert">{error}</span>}
    </label>
  );
}
