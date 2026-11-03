"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { usePerfil } from "@/components/ContextoPerfil";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Manzana, Perfil, Rol, Zona } from "@/lib/tipos";

const NUEVO = { email: "", password: "", nombre_completo: "", rol: "coordinador" as Rol, zona_id: "" };

export default function PaginaAdministracion() {
  const perfil = usePerfil();
  const router = useRouter();
  const esAdmin = perfil.rol === "administrador";
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [nuevo, setNuevo] = useState(NUEVO);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [manzanas, setManzanas] = useState<Manzana[]>([]);

  const cargar = useCallback(async () => {
    const db = crearClienteNavegador();
    const [p, z] = await Promise.all([db.from("perfiles").select("*").order("nombre_completo"), db.from("zonas").select("*").order("numero")]);
    setPerfiles((p.data ?? []) as Perfil[]);
    setZonas((z.data ?? []) as Zona[]);
  }, []);

  useEffect(() => {
    if (!esAdmin) { router.replace("/mapa"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void cargar();
  }, [esAdmin, router, cargar]);

  if (!esAdmin) return null;

  async function crear(e: FormEvent) {
    e.preventDefault();
    setMensaje("");
    const r = await fetch("/api/admin/usuarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nuevo) });
    if (!r.ok) { setMensaje((await r.json()).error ?? "No se pudo crear el usuario."); return; }
    setMensaje(`Usuario ${nuevo.email} creado. Entréguele su contraseña en privado.`);
    setNuevo(NUEVO);
    void cargar();
  }

  async function alternarActivo(p: Perfil) {
    const { error } = await crearClienteNavegador().from("perfiles").update({ activo: !p.activo }).eq("id", p.id);
    if (error) setMensaje("No se pudo actualizar el usuario.");
    void cargar();
  }

  async function buscar(e: FormEvent) {
    e.preventDefault();
    const { data } = await crearClienteNavegador().from("manzanas").select("*").ilike("codigo", `%${busqueda.trim()}%`).order("codigo").limit(30);
    setManzanas((data ?? []) as Manzana[]);
  }

  async function alternarManzana(m: Manzana) {
    const { error } = await crearClienteNavegador().from("manzanas").update({ activa: !m.activa }).eq("id", m.id);
    if (error) { setMensaje("No se pudo actualizar la manzana."); return; }
    setManzanas((l) => l.map((x) => (x.id === m.id ? { ...x, activa: !x.activa } : x)));
  }

  const nombreZona = (id: string | null) => zonas.find((z) => z.id === id)?.nombre ?? "Todas";

  return (
    <div className="pila">
      <h1>Administración</h1>
      <div><Link className="boton secundario" href="/administracion/importar">Importar desde Google Forms</Link></div>

      <section className="tarjeta pila">
        <h2>Crear usuario</h2>
        <form className="pila" onSubmit={crear}>
          <label className="campo"><span>Nombre completo</span><input required value={nuevo.nombre_completo} onChange={(e) => setNuevo({ ...nuevo, nombre_completo: e.target.value })} /></label>
          <label className="campo"><span>Correo</span><input type="email" required autoComplete="off" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} /></label>
          <label className="campo"><span>Contraseña inicial (mínimo 8 caracteres)</span><input type="password" required minLength={8} autoComplete="new-password" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} /></label>
          <label className="campo"><span>Rol</span>
            <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as Rol })}>
              <option value="coordinador">Coordinador</option>
              <option value="administrador">Administrador</option>
            </select>
          </label>
          {nuevo.rol === "coordinador" && (
            <label className="campo"><span>Zona</span>
              <select required value={nuevo.zona_id} onChange={(e) => setNuevo({ ...nuevo, zona_id: e.target.value })}>
                <option value="">Elija una zona</option>
                {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
            </label>
          )}
          <div><button className="boton">Crear usuario</button></div>
        </form>
        {mensaje && <p role="status">{mensaje}</p>}
      </section>

      <section className="tarjeta tabla-envoltura">
        <h2>Usuarios</h2>
        <table>
          <thead><tr><th>Nombre</th><th>Rol</th><th>Zona</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {perfiles.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre_completo}</td>
                <td>{p.rol === "administrador" ? "Administrador" : "Coordinador"}</td>
                <td>{nombreZona(p.zona_id)}</td>
                <td>{p.activo ? "Activo" : "Inactivo"}</td>
                <td>{p.id !== perfil.id && <button className="boton secundario" onClick={() => void alternarActivo(p)}>{p.activo ? "Desactivar" : "Activar"}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="tarjeta pila">
        <h2>Manzanas</h2>
        <p className="tenue">Desactive una manzana errónea para que no aparezca en el mapa ni cuente en el avance.</p>
        <form className="fila" onSubmit={buscar}>
          <label className="campo"><span>Código</span><input placeholder="Z1-014" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></label>
          <button className="boton secundario">Buscar</button>
        </form>
        {manzanas.map((m) => (
          <div key={m.id} className="fila">
            <span>{m.codigo}: {m.activa ? "Activa" : "Inactiva"}</span>
            <button className="boton secundario" onClick={() => void alternarManzana(m)}>{m.activa ? "Desactivar" : "Activar"}</button>
          </div>
        ))}
      </section>
    </div>
  );
}
