"use client";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Crosshair, Users, Baby, Coins, HeartPulse, Layers, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import MapaPuntosDinamico from "@/components/MapaPuntosDinamico";
import { usePerfil } from "@/components/ContextoPerfil";
import { Campo, Contador, Paso, SiNo } from "@/components/ui/Controles";
import { aFilaCulto, cultoVacio, validarCulto, type DatosCulto, type ErroresCulto } from "@/lib/culto/validar";
import { zonaDePunto } from "@/lib/mapa/zonaDePunto";
import { eligeZona, zonasPermitidas } from "@/lib/roles";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Sector, Zona } from "@/lib/tipos";

type Props = { inicial?: DatosCulto; cultoId?: string; alGuardar: (id: string) => void };
type Conteo = "hermanos" | "amigos" | "ninos";
const entero = (t: string) => (/^\d+$/.test(t) ? +t : 0);

export default function FormularioCulto({ inicial, cultoId, alGuardar }: Props) {
  const perfil = usePerfil();
  const puedeElegir = eligeZona(perfil);
  const [d, setD] = useState<DatosCulto>(() => inicial ?? cultoVacio(perfil.zona_id ?? ""));
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [errores, setErrores] = useState<ErroresCulto>({});
  const [aviso, setAviso] = useState("");
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const db = crearClienteNavegador();
    void Promise.all([db.from("zonas").select("*").order("numero"), db.from("sectores").select("*").order("numero")]).then(([z, s]) => {
      if (z.error || s.error) { setAviso("No se pudieron cargar las zonas. Revise su conexión y recargue la página."); return; }
      setZonas(z.data as Zona[]);
      setSectores(s.data as Sector[]);
    });
  }, []);

  const permitidas = useMemo(() => zonasPermitidas(perfil, zonas), [perfil, zonas]);
  // Al corregir un campo se quita su mensaje de error, sin esperar al siguiente intento de guardar.
  const quitarError = (c: keyof ErroresCulto) => setErrores((e) => (e[c] ? { ...e, [c]: undefined } : e));
  const poner = <K extends keyof DatosCulto>(c: K, v: DatosCulto[K]) => { setD((a) => ({ ...a, [c]: v })); quitarError(c); };
  const marcador = useMemo(() => (d.lat !== null && d.lon !== null ? { lat: d.lat, lon: d.lon } : null), [d.lat, d.lon]);

  // Ubica la casa y, si el usuario maneja varias zonas, propone la zona donde cayó el punto.
  function ubicar(lat: number, lon: number, precision: number | null) {
    const zona = zonaDePunto(permitidas, lat, lon);
    const zonaFinal = puedeElegir && zona ? zona.id : d.zona_id;
    setD((a) => ({ ...a, lat, lon, precision_m: precision, zona_id: zonaFinal }));
    quitarError("ubicacion");
    const nombre = permitidas.find((z) => z.id === zonaFinal)?.nombre ?? "sus zonas";
    setAviso(zona?.id === zonaFinal ? "" : `La ubicación queda fuera de ${nombre}. Verifique el punto en el mapa antes de guardar.`);
  }

  function usarGps() {
    if (!navigator.geolocation) { setAviso("Este dispositivo no permite obtener la ubicación. Marque la casa tocando el mapa."); return; }
    setBuscandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setBuscandoGps(false); ubicar(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy)); },
      () => { setBuscandoGps(false); setAviso("No se pudo obtener la ubicación. Active el GPS y dé permiso, o marque la casa tocando el mapa."); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const encontrados = validarCulto(d);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;
    setEnviando(true);
    const db = crearClienteNavegador();
    const fila = aFilaCulto(d);
    const r = cultoId
      ? await db.from("cultos").update(fila).eq("id", cultoId).select("id").single()
      : await db.from("cultos").insert(fila).select("id").single();
    setEnviando(false);
    if (r.error || !r.data) { setAviso("No se pudo guardar. Revise su conexión e intente de nuevo; lo escrito no se ha perdido."); return; }
    alGuardar(r.data.id);
  }

  const numero = (c: Conteo, etiqueta: string, icono: ReactNode) => (
    <div className="campo">
      <span>{icono} {etiqueta}</span>
      <Contador nombre={c} etiqueta={etiqueta} valor={d[c]} alCambiar={(v) => poner(c, v)} />
      {errores[c] && <span className="error" role="alert">{errores[c]}</span>}
    </div>
  );
  const total = entero(d.hermanos) + entero(d.amigos) + entero(d.ninos);
  const nombreZona = zonas.find((z) => z.id === d.zona_id)?.nombre;
  const hayErrores = Object.values(errores).some(Boolean);

  return (
    <form className="formulario-con-resumen" onSubmit={enviar} noValidate>
      <div className="pila">
        <section className="tarjeta pila">
          <Paso numero={1} titulo="La casa" detalle="Dónde se hizo el culto" />
          <div className="rejilla-campos">
            <Campo etiqueta="Fecha del culto" error={errores.fecha}>
              <input name="fecha" type="date" value={d.fecha} onChange={(e) => poner("fecha", e.target.value)} />
            </Campo>
            {puedeElegir ? (
              <Campo etiqueta="Zona" error={errores.zona_id} icono={<Layers size={16} />}>
                <select name="zona_id" value={d.zona_id} onChange={(e) => poner("zona_id", e.target.value)}>
                  <option value="">Seleccione una zona...</option>
                  {permitidas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                </select>
              </Campo>
            ) : (
              <div className="campo"><span><Layers size={16} /> Zona</span><b>{nombreZona ?? "..."}</b></div>
            )}
          </div>
          <Campo etiqueta="Dirección de la casa" error={errores.direccion}>
            <input name="direccion" placeholder="Ej: Calle 18B # 19-30, casa de la hermana Rosa" value={d.direccion} onChange={(e) => poner("direccion", e.target.value)} />
          </Campo>
          <div className="ubicacion">
            <MapaPuntosDinamico zonas={zonas} sectores={sectores} marcador={marcador} alElegir={(lat, lon) => ubicar(lat, lon, null)} />
            <div className="pila" style={{ gap: 10 }}>
              <button type="button" className="boton" onClick={usarGps} disabled={buscandoGps}>
                <Crosshair size={18} /><span>{buscandoGps ? "Buscando ubicación..." : "Usar mi ubicación"}</span>
              </button>
              <p aria-live="polite" className={marcador ? "exito-box" : "tenue"} style={{ fontSize: "0.85rem" }}>
                {marcador
                  ? <><CheckCircle2 size={16} /><span>Ubicación: {marcador.lat.toFixed(6)}, {marcador.lon.toFixed(6)}{d.precision_m ? ` (precisión ${d.precision_m} m)` : ""}</span></>
                  : "Sin ubicación todavía"}
              </p>
              <p className="tenue" style={{ fontSize: "0.82rem" }}>Estando en la casa, toque el botón. También puede tocar el mapa para mover el punto.</p>
              {errores.ubicacion && <span className="error" role="alert">{errores.ubicacion}</span>}
            </div>
          </div>
        </section>

        <section className="tarjeta pila">
          <Paso numero={2} titulo="Asistencia y ofrenda" detalle="Toque − y + para contar" />
          <div className="rejilla-campos rejilla-4">
            {numero("hermanos", "Hermanos", <Users size={16} />)}
            {numero("amigos", "Amigos", <Users size={16} />)}
            {numero("ninos", "Niños", <Baby size={16} />)}
            <Campo etiqueta="Ofrenda (pesos)" error={errores.ofrenda} icono={<Coins size={16} />}>
              <input name="ofrenda" inputMode="numeric" placeholder="Ej: 50.000" value={d.ofrenda} onChange={(e) => poner("ofrenda", e.target.value)} />
            </Campo>
          </div>
        </section>

        <section className="tarjeta pila">
          <Paso numero={3} titulo="Enfermos y observaciones" />
          <div className="rejilla-campos">
            <div className="campo">
              <span><HeartPulse size={16} /> ¿Hubo personas enfermas?</span>
              <SiNo etiqueta="Hubo personas enfermas" valor={d.hubo_enfermos}
                alCambiar={(v) => setD((a) => ({ ...a, hubo_enfermos: v, se_oro_enfermos: v ? a.se_oro_enfermos : false }))} />
            </div>
            {d.hubo_enfermos && (
              <div className="campo">
                <span>¿Se oró por ellas?</span>
                <SiNo etiqueta="Se oró por los enfermos" valor={d.se_oro_enfermos} alCambiar={(v) => poner("se_oro_enfermos", v)} />
              </div>
            )}
          </div>
          <Campo etiqueta="Observaciones (opcional)">
            <textarea name="observaciones" value={d.observaciones} onChange={(e) => poner("observaciones", e.target.value)} />
          </Campo>
        </section>
      </div>

      <aside className="resumen">
        <p className="resumen-titulo">Resumen del culto</p>
        <p className="resumen-total">{total} {total === 1 ? "persona" : "personas"}</p>
        <dl>
          <div><dt>Hermanos</dt><dd>{entero(d.hermanos)}</dd></div>
          <div><dt>Amigos</dt><dd>{entero(d.amigos)}</dd></div>
          <div><dt>Niños</dt><dd>{entero(d.ninos)}</dd></div>
          <div><dt>Zona</dt><dd>{nombreZona ?? "-"}</dd></div>
          <div><dt>Ubicación</dt><dd>{marcador ? "Lista" : "Falta"}</dd></div>
        </dl>
        {hayErrores && <p className="aviso" role="alert"><AlertCircle size={18} /><span>Revise los campos marcados en rojo.</span></p>}
        {aviso && <p className="aviso" role="alert"><AlertCircle size={18} /><span>{aviso}</span></p>}
        <button className="boton grande" disabled={enviando}><Save size={18} /><span>{enviando ? "Guardando..." : "Guardar culto"}</span></button>
      </aside>
    </form>
  );
}
