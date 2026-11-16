"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Crosshair, Save, AlertCircle, Phone, Layers, CheckCircle2, UserPlus, Trash2, ShieldCheck, Users, Home } from "lucide-react";
import MapaPuntosDinamico from "@/components/MapaPuntosDinamico";
import { usePerfil } from "@/components/ContextoPerfil";
import { Campo, Paso, SiNo } from "@/components/ui/Controles";
import { useGps } from "@/lib/gps";
import {
  aParametrosHogar, esMenor, hayMenores, hogarVacio, integranteVacio, PARENTESCOS, validarHogar,
  type DatosHogar, type ErroresHogar, type Integrante,
} from "@/lib/hogar/validar";
import { zonaDePunto } from "@/lib/mapa/zonaDePunto";
import { ETIQUETA_ESTADO, type EstadoSeguimiento } from "@/lib/persona/validar";
import { eligeZona, zonasPermitidas } from "@/lib/roles";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Sector, Zona } from "@/lib/tipos";

type Props = { inicial?: DatosHogar; cultoId?: string | null; alGuardar: (id: string) => void };
type CampoHogar = Exclude<keyof DatosHogar, "integrantes">;

export default function FormularioHogar({ inicial, cultoId = null, alGuardar }: Props) {
  const perfil = usePerfil();
  const puedeElegir = eligeZona(perfil);
  const [d, setD] = useState<DatosHogar>(() => inicial ?? hogarVacio(perfil.zona_id ?? "", cultoId));
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [errores, setErrores] = useState<ErroresHogar>({});
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
  const nombreZona = zonas.find((z) => z.id === d.zona_id)?.nombre;
  const menores = d.integrantes.filter(esMenor).length;

  const poner = <K extends CampoHogar>(c: K, v: DatosHogar[K]) => {
    setD((a) => ({ ...a, [c]: v }));
    setErrores((e) => (e[c] ? { ...e, [c]: undefined } : e));
  };
  const ponerIntegrante = <K extends keyof Integrante>(n: number, c: K, v: Integrante[K]) => {
    setD((a) => ({ ...a, integrantes: a.integrantes.map((i, k) => (k === n ? { ...i, [c]: v } : i)) }));
    setErrores((e) => {
      const por = e.porIntegrante?.map((x, k) => (k === n ? { ...x, [c]: undefined } : x));
      return { ...e, porIntegrante: por, autorizacion_menores: c === "edad" ? undefined : e.autorizacion_menores };
    });
  };
  const agregar = () => {
    setD((a) => ({ ...a, integrantes: [...a.integrantes, integranteVacio()] }));
    setErrores((e) => ({ ...e, integrantes: undefined }));
  };
  const quitar = (n: number) => {
    setD((a) => ({ ...a, integrantes: a.integrantes.filter((_, k) => k !== n) }));
    setErrores((e) => ({ ...e, porIntegrante: e.porIntegrante?.filter((_, k) => k !== n) }));
  };

  function ubicar(lat: number, lon: number, precision: number | null = null) {
    const zona = zonaDePunto(permitidas, lat, lon);
    setD((a) => ({ ...a, lat, lon, precision_m: precision, zona_id: puedeElegir && zona ? zona.id : a.zona_id }));
    setErrores((e) => ({ ...e, zona_id: undefined }));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const encontrados = validarHogar(d);
    setErrores(encontrados);
    if (Object.values(encontrados).some(Boolean)) { setAviso(""); return; }
    setEnviando(true);
    const { data, error } = await crearClienteNavegador().rpc("guardar_hogar", aParametrosHogar(d));
    setEnviando(false);
    if (error || !data) { setAviso("No se pudo guardar. Revise su conexión e intente de nuevo; lo escrito no se ha perdido."); return; }
    alGuardar(data as string);
  }

  const errorDe = (n: number, c: keyof Integrante) => errores.porIntegrante?.[n]?.[c];
  const hayErrores = Object.values(errores).some((v) => (Array.isArray(v) ? v.some((x) => Object.values(x).some(Boolean)) : Boolean(v)));

  return (
    <form className="formulario-con-resumen" onSubmit={enviar} noValidate>
      <div className="pila">
        <section className="tarjeta pila">
          <Paso numero={1} titulo="El hogar" detalle="La casa que se visitó" />
          <div className="rejilla-campos">
            <Campo etiqueta="Familia" error={errores.familia} icono={<Home size={16} />}>
              <input name="familia" placeholder="Ej: Familia Pérez Gómez" value={d.familia} onChange={(e) => poner("familia", e.target.value)} />
            </Campo>
            {puedeElegir ? (
              <Campo etiqueta="Zona" error={errores.zona_id} icono={<Layers size={16} />}>
                <select name="zona_id" value={d.zona_id} onChange={(e) => poner("zona_id", e.target.value)}>
                  <option value="">Seleccione una zona...</option>
                  {permitidas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                </select>
              </Campo>
            ) : <div className="campo"><span><Layers size={16} /> Zona</span><b>{nombreZona ?? "..."}</b></div>}
            <Campo etiqueta="Teléfono del hogar (opcional)" error={errores.telefono} icono={<Phone size={16} />}>
              <input name="telefono" type="tel" inputMode="tel" placeholder="Ej: 300 123 4567" value={d.telefono} onChange={(e) => poner("telefono", e.target.value)} />
            </Campo>
            <Campo etiqueta="Quién recibió la visita (opcional)">
              <input name="atendio" placeholder="Ej: la abuela, señora Carmen" value={d.atendio} onChange={(e) => poner("atendio", e.target.value)} />
            </Campo>
          </div>
          <Campo etiqueta="Dirección" error={errores.direccion}>
            <input name="direccion" placeholder="Ej: Calle 17 # 20-15" value={d.direccion} onChange={(e) => poner("direccion", e.target.value)} />
          </Campo>
          <div className="ubicacion">
            <MapaPuntosDinamico zonas={zonas} sectores={sectores} marcador={marcador} alElegir={(lat, lon) => ubicar(lat, lon)} />
            <div className="pila" style={{ gap: 10 }}>
              <button type="button" className="boton" onClick={() => gps.pedir((p) => ubicar(p.lat, p.lon, p.precision ?? null))} disabled={gps.buscando}>
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
          <Paso numero={2} titulo="Integrantes de la familia" detalle="Todas las personas que viven en el hogar, incluidos los niños" />
          {errores.integrantes && <span className="error" role="alert">{errores.integrantes}</span>}
          {d.integrantes.map((i, n) => (
            <fieldset key={n} className="integrante" aria-label={`Integrante ${n + 1}`}>
              <legend><span className="paso-numero">{n + 1}</span>{i.nombre.trim() || "Nuevo integrante"}{esMenor(i) && <span className="badge badge-marca">Menor</span>}</legend>
              <div className="rejilla-campos">
                <Campo etiqueta="Nombre completo" error={errorDe(n, "nombre")}>
                  <input name={`integrante-${n}-nombre`} value={i.nombre} onChange={(e) => ponerIntegrante(n, "nombre", e.target.value)} />
                </Campo>
                <Campo etiqueta="Edad (años)" error={errorDe(n, "edad")}>
                  <input name={`integrante-${n}-edad`} inputMode="numeric" value={i.edad} onChange={(e) => ponerIntegrante(n, "edad", e.target.value)} />
                </Campo>
                <Campo etiqueta="Parentesco" error={errorDe(n, "parentesco")}>
                  <select name={`integrante-${n}-parentesco`} value={i.parentesco} onChange={(e) => ponerIntegrante(n, "parentesco", e.target.value)}>
                    <option value="">Elija...</option>
                    {PARENTESCOS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Campo>
                <Campo etiqueta="Teléfono (opcional)" error={errorDe(n, "telefono")}>
                  <input name={`integrante-${n}-telefono`} type="tel" inputMode="tel" value={i.telefono} onChange={(e) => ponerIntegrante(n, "telefono", e.target.value)} />
                </Campo>
              </div>
              <div className="rejilla-campos rejilla-4">
                <div className="campo"><span>¿Está enfermo?</span><SiNo etiqueta={`Integrante ${n + 1} enfermo`} valor={i.enfermo} alCambiar={(v) => ponerIntegrante(n, "enfermo", v)} /></div>
                <div className="campo"><span>¿Pide oración?</span><SiNo etiqueta={`Integrante ${n + 1} pide oración`} valor={i.pide_oracion} alCambiar={(v) => ponerIntegrante(n, "pide_oracion", v)} /></div>
                <div className="campo"><span>¿Se entregó a Cristo?</span><SiNo etiqueta={`Integrante ${n + 1} se entregó`} valor={i.entrego_vida} alCambiar={(v) => ponerIntegrante(n, "entrego_vida", v)} /></div>
                <Campo etiqueta="Seguimiento">
                  <select value={i.estado_seguimiento} onChange={(e) => ponerIntegrante(n, "estado_seguimiento", e.target.value as EstadoSeguimiento)}>
                    {Object.entries(ETIQUETA_ESTADO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </Campo>
              </div>
              {i.pide_oracion && (
                <Campo etiqueta="Petición de oración" error={errorDe(n, "peticion")}>
                  <input name={`integrante-${n}-peticion`} value={i.peticion} onChange={(e) => ponerIntegrante(n, "peticion", e.target.value)} />
                </Campo>
              )}
              {d.integrantes.length > 1 && (
                <button type="button" className="boton peligro" style={{ alignSelf: "flex-start" }} onClick={() => quitar(n)}><Trash2 size={16} /><span>Quitar integrante</span></button>
              )}
            </fieldset>
          ))}
          <button type="button" className="boton secundario" onClick={agregar}><UserPlus size={18} /><span>Agregar integrante</span></button>
        </section>

        <section className="tarjeta pila">
          <Paso numero={3} titulo="Necesidad y oración del hogar" />
          <Campo etiqueta="Calamidad o necesidad (opcional)">
            <textarea name="calamidad" placeholder="Ej: perdieron la casa en la creciente, falta de alimentos" value={d.calamidad} onChange={(e) => poner("calamidad", e.target.value)} />
          </Campo>
          <div className="campo"><span>¿El hogar pide oración?</span><SiNo etiqueta="El hogar pide oración" valor={d.pide_oracion} alCambiar={(v) => poner("pide_oracion", v)} /></div>
          {d.pide_oracion && (
            <Campo etiqueta="Petición del hogar" error={errores.peticion}>
              <textarea name="peticion" value={d.peticion} onChange={(e) => poner("peticion", e.target.value)} />
            </Campo>
          )}
          <div className="rejilla-campos">
            <Campo etiqueta="Seguimiento del hogar">
              <select name="estado_seguimiento" value={d.estado_seguimiento} onChange={(e) => poner("estado_seguimiento", e.target.value as EstadoSeguimiento)}>
                {Object.entries(ETIQUETA_ESTADO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </Campo>
          </div>
          <Campo etiqueta="Notas (opcional)">
            <textarea name="notas" value={d.notas} onChange={(e) => poner("notas", e.target.value)} />
          </Campo>
        </section>

        {hayMenores(d) && (
          <section className="tarjeta pila tarjeta-destacada" style={{ borderLeftColor: "var(--aviso)" }}>
            <h2><ShieldCheck size={22} /><span>Autorización para los menores</span></h2>
            <label className={`casilla ${d.autorizacion_menores ? "casilla-activa" : ""}`}>
              <input name="autorizacion_menores" type="checkbox" checked={d.autorizacion_menores} onChange={(e) => poner("autorizacion_menores", e.target.checked)} />
              <span>El adulto responsable autorizó que la iglesia guarde los datos de los menores de este hogar para su acompañamiento espiritual y social (Ley 1581 de 2012).</span>
            </label>
            {errores.autorizacion_menores && <span className="error" role="alert">{errores.autorizacion_menores}</span>}
          </section>
        )}
      </div>

      <aside className="resumen">
        <p className="resumen-titulo">Resumen de la visita</p>
        <p className="resumen-total">{d.familia.trim() || "Hogar sin nombre"}</p>
        <dl>
          <div><dt><Users size={14} /> Integrantes</dt><dd>{d.integrantes.length}</dd></div>
          <div><dt>Niños y jóvenes</dt><dd>{menores}</dd></div>
          <div><dt>Enfermos</dt><dd>{d.integrantes.filter((i) => i.enfermo).length}</dd></div>
          <div><dt>Zona</dt><dd>{nombreZona ?? "-"}</dd></div>
          <div><dt>Ubicación</dt><dd>{marcador ? "Lista" : "Sin marcar"}</dd></div>
        </dl>
        {hayErrores && <p className="aviso" role="alert"><AlertCircle size={18} /><span>Revise los campos marcados en rojo.</span></p>}
        {aviso && <p className="aviso" role="alert"><AlertCircle size={18} /><span>{aviso}</span></p>}
        <button className="boton grande" disabled={enviando}><Save size={18} /><span>{enviando ? "Guardando..." : "Guardar hogar"}</span></button>
      </aside>
    </form>
  );
}
