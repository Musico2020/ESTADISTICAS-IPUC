"use client";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Crosshair, Save, AlertCircle, User, Phone, Layers, CheckCircle2 } from "lucide-react";
import MapaPuntosDinamico from "@/components/MapaPuntosDinamico";
import { usePerfil } from "@/components/ContextoPerfil";
import { Campo, Paso, SiNo } from "@/components/ui/Controles";
import { useGps } from "@/lib/gps";
import { zonaDePunto } from "@/lib/mapa/zonaDePunto";
import { aFilaPersona, ETIQUETA_ESTADO, personaVacia, validarPersona, type DatosPersona, type ErroresPersona, type EstadoSeguimiento } from "@/lib/persona/validar";
import { eligeZona, zonasPermitidas } from "@/lib/roles";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Sector, Zona } from "@/lib/tipos";

const REVISE = "Revise los campos marcados en rojo.";

type Props = { inicial?: DatosPersona; personaId?: string; cultoId?: string | null; alGuardar: (id: string) => void };

export default function FormularioPersona({ inicial, personaId, cultoId = null, alGuardar }: Props) {
  const perfil = usePerfil();
  const puedeElegir = eligeZona(perfil);
  const [d, setD] = useState<DatosPersona>(() => inicial ?? personaVacia(perfil.zona_id ?? "", cultoId));
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
  const sino = (c: "enfermo" | "pide_oracion" | "entrego_vida", etiqueta: string) => (
    <div className="campo"><span>{etiqueta}</span><SiNo etiqueta={etiqueta} valor={d[c]} alCambiar={(v) => poner(c, v)} /></div>
  );

  return (
    <form className="pila" onSubmit={enviar} noValidate>
      <section className="tarjeta pila">
        <Paso numero={1} titulo="Datos del amigo" />
        <div className="rejilla-campos">
          {texto("nombre", "Nombre completo", { icono: <User size={16} /> })}
          {texto("edad", "Edad (opcional)")}
          {texto("telefono", "Teléfono (opcional)", { icono: <Phone size={16} />, tipo: "tel", ayuda: "Ej: 300 123 4567" })}
          {puedeElegir ? (
            <Campo etiqueta="Zona" error={errores.zona_id} icono={<Layers size={16} />}>
              <select name="zona_id" value={d.zona_id} onChange={(e) => poner("zona_id", e.target.value)}>
                <option value="">Seleccione una zona...</option>
                {permitidas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
            </Campo>
          ) : <div className="campo"><span><Layers size={16} /> Zona</span><b>{zonas.find((z) => z.id === d.zona_id)?.nombre ?? "..."}</b></div>}
        </div>
        {area("familia", "Familia (opcional)")}
      </section>

      <section className="tarjeta pila">
        <Paso numero={2} titulo="Ubicación" detalle="Opcional" />
        {texto("direccion", "Dirección", { ayuda: "Ej: Calle 17 # 20-15" })}
        <div className="ubicacion">
          <MapaPuntosDinamico zonas={zonas} sectores={sectores} marcador={marcador} alElegir={ubicar} />
          <div className="pila" style={{ gap: 10 }}>
            <button type="button" className="boton secundario" onClick={() => gps.pedir((p) => ubicar(p.lat, p.lon))} disabled={gps.buscando}>
              <Crosshair size={18} /><span>{gps.buscando ? "Buscando ubicación..." : "Usar mi ubicación"}</span>
            </button>
            {gps.error && <span className="error" role="alert">{gps.error}</span>}
            <p className={marcador ? "exito-box" : "tenue"} style={{ fontSize: "0.85rem" }}>
              {marcador ? <><CheckCircle2 size={16} /><span>Ubicación: {marcador.lat.toFixed(6)}, {marcador.lon.toFixed(6)}</span></> : "Sin ubicación. Puede tocar el mapa para marcar la casa."}
            </p>
          </div>
        </div>
      </section>

      <section className="tarjeta pila">
        <Paso numero={3} titulo="Necesidades y oración" />
        {area("calamidad", "Necesidad (opcional)", "Ej: perdió el empleo, falta de alimentos")}
        <div className="rejilla-campos">
          {sino("enfermo", "¿Está enfermo?")}
          {sino("pide_oracion", "¿Pide oración?")}
        </div>
        {d.pide_oracion && area("peticion", "Petición de oración")}
      </section>

      <section className="tarjeta pila">
        <Paso numero={4} titulo="Seguimiento" />
        <div className="rejilla-campos">
          {sino("entrego_vida", "¿Se entregó a Cristo?")}
          <Campo etiqueta="Estado del seguimiento">
            <select name="estado_seguimiento" value={d.estado_seguimiento} onChange={(e) => poner("estado_seguimiento", e.target.value as EstadoSeguimiento)}>
              {Object.entries(ETIQUETA_ESTADO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </Campo>
        </div>
        {area("notas", "Notas (opcional)")}
      </section>

      {aviso && <p className="aviso" role="alert"><AlertCircle size={18} /><span>{aviso}</span></p>}
      <button className="boton grande" disabled={enviando}><Save size={18} /><span>{enviando ? "Guardando..." : "Guardar ficha"}</span></button>
    </form>
  );
}
