"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  UserPlus,
  Users,
  MapPin,
  UploadCloud,
  Lock,
  User,
  Layers,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Power,
} from "lucide-react";
import { usePerfil } from "@/components/ContextoPerfil";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Manzana, Perfil, Rol, Zona } from "@/lib/tipos";

const NUEVO = { usuario: "", password: "", nombre_completo: "", rol: "coordinador" as Rol, zona_id: "" };

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
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const db = crearClienteNavegador();
    const [p, z] = await Promise.all([
      db.from("perfiles").select("*").order("nombre_completo"),
      db.from("zonas").select("*").order("numero"),
    ]);
    setPerfiles((p.data ?? []) as Perfil[]);
    setZonas((z.data ?? []) as Zona[]);
  }, []);

  useEffect(() => {
    if (!esAdmin) {
      router.replace("/mapa");
      return;
    }
    void cargar();
  }, [esAdmin, router, cargar]);

  if (!esAdmin) return null;

  async function crear(e: FormEvent) {
    e.preventDefault();
    setMensaje("");
    setGuardando(true);
    const r = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevo),
    });
    setGuardando(false);
    if (!r.ok) {
      setMensaje((await r.json()).error ?? "No se pudo crear el usuario.");
      return;
    }
    setMensaje(`Usuario ${nuevo.usuario} creado exitosamente. Entréguele su contraseña en privado.`);
    setNuevo(NUEVO);
    void cargar();
  }

  async function alternarActivo(p: Perfil) {
    const { error } = await crearClienteNavegador().from("perfiles").update({ activo: !p.activo }).eq("id", p.id);
    if (error) setMensaje("No se pudo actualizar el estado del usuario.");
    void cargar();
  }

  async function buscar(e: FormEvent) {
    e.preventDefault();
    const { data } = await crearClienteNavegador()
      .from("manzanas")
      .select("*")
      .ilike("codigo", `%${busqueda.trim()}%`)
      .order("codigo")
      .limit(30);
    setManzanas((data ?? []) as Manzana[]);
  }

  async function alternarManzana(m: Manzana) {
    const { error } = await crearClienteNavegador().from("manzanas").update({ activa: !m.activa }).eq("id", m.id);
    if (error) {
      setMensaje("No se pudo actualizar la manzana.");
      return;
    }
    setManzanas((l) => l.map((x) => (x.id === m.id ? { ...x, activa: !x.activa } : x)));
  }

  const nombreZona = (id: string | null) => zonas.find((z) => z.id === id)?.nombre ?? "Todas las zonas";

  return (
    <div className="pila">
      {/* Encabezado */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div>
          <h1>
            <ShieldCheck size={28} style={{ color: "var(--marca)" }} />
            <span>Panel de Administración</span>
          </h1>
          <p className="tenue">
            Gestión de usuarios coordinadores, roles de acceso y catálogo cartográfico
          </p>
        </div>
        <Link href="/administracion/importar" className="boton secundario">
          <UploadCloud size={18} />
          <span>Importar desde Google Forms</span>
        </Link>
      </div>

      {mensaje && (
        <div
          className="aviso"
          style={{
            background: mensaje.includes("exitosamente") ? "var(--exito-fondo)" : "var(--aviso-fondo)",
            borderColor: mensaje.includes("exitosamente") ? "var(--exito-borde)" : "var(--aviso-borde)",
            color: mensaje.includes("exitosamente") ? "var(--exito)" : "var(--aviso-texto)",
          }}
          role="status"
        >
          {mensaje.includes("exitosamente") ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{mensaje}</span>
        </div>
      )}

      {/* Crear Usuario */}
      <section className="tarjeta pila">
        <h2>
          <UserPlus size={22} style={{ color: "var(--marca)" }} />
          <span>Crear nuevo usuario coordinador</span>
        </h2>
        <form className="pila" onSubmit={crear}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            <label className="campo">
              <span><User size={15} /> Nombre completo</span>
              <input
                required
                placeholder="Ej: Daniel Gómez"
                value={nuevo.nombre_completo}
                onChange={(e) => setNuevo({ ...nuevo, nombre_completo: e.target.value })}
              />
            </label>

            <label className="campo">
              <span><User size={15} /> Usuario para ingresar</span>
              <input
                required
                autoCapitalize="none"
                placeholder="Ej: daniel"
                autoComplete="off"
                value={nuevo.usuario}
                onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })}
              />
            </label>

            <label className="campo">
              <span><Lock size={15} /> Contraseña inicial (mínimo 8 car.)</span>
              <input
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                autoComplete="new-password"
                value={nuevo.password}
                onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
              />
            </label>

            <label className="campo">
              <span><ShieldCheck size={15} /> Rol en la plataforma</span>
              <select
                value={nuevo.rol}
                onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as Rol })}
              >
                <option value="coordinador">Coordinador de Zona</option>
                <option value="usuario">Usuario (todas las zonas)</option>
                <option value="administrador">Administrador General</option>
              </select>
            </label>

            {nuevo.rol === "coordinador" && (
              <label className="campo">
                <span><Layers size={15} /> Zona asignada</span>
                <select
                  required
                  value={nuevo.zona_id}
                  onChange={(e) => setNuevo({ ...nuevo, zona_id: e.target.value })}
                >
                  <option value="">Seleccione una zona...</option>
                  {zonas.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="boton" disabled={guardando}>
              <UserPlus size={16} />
              <span>{guardando ? "Creando usuario..." : "Registrar usuario"}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Tabla de Usuarios */}
      <section className="tarjeta pila" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 22px 14px" }}>
          <h2>
            <Users size={22} style={{ color: "var(--marca)" }} />
            <span>Usuarios y coordinadores activos ({perfiles.length})</span>
          </h2>
        </div>
        <div className="tabla-envoltura" style={{ border: "none", boxShadow: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Zona asignada</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {perfiles.map((p) => {
                const iniciales = p.nombre_completo
                  ? p.nombre_completo
                      .split(" ")
                      .slice(0, 2)
                      .map((x) => x[0]?.toUpperCase())
                      .join("")
                  : "U";
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "var(--marca-fondo)",
                            color: "var(--marca)",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {iniciales}
                        </div>
                        <div>
                          <b style={{ display: "block" }}>{p.nombre_completo}</b>
                          {p.id === perfil.id && (
                            <span className="tenue" style={{ fontSize: "0.75rem" }}>
                              (Su cuenta actual)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${p.rol === "administrador" ? "badge-marca" : "badge-tenue"}`}>
                        {p.rol === "administrador" ? "Administrador" : p.rol === "usuario" ? "Usuario" : "Coordinador"}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-tenue">
                        <Layers size={12} /> {nombreZona(p.zona_id)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.activo ? "badge-exito" : "badge-aviso"}`}>
                        <span className={`punto-estado ${p.activo ? "punto-exito" : "punto-aviso"}`} />
                        <span>{p.activo ? "Activo" : "Inactivo"}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {p.id !== perfil.id && (
                        <button
                          type="button"
                          className="boton secundario"
                          style={{ minHeight: 32, padding: "4px 10px", fontSize: "0.8rem" }}
                          onClick={() => void alternarActivo(p)}
                        >
                          <Power size={13} />
                          <span>{p.activo ? "Desactivar" : "Activar"}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gestión de Manzanas */}
      <section className="tarjeta pila">
        <div>
          <h2>
            <MapPin size={22} style={{ color: "var(--marca)" }} />
            <span>Gestión del catálogo de manzanas</span>
          </h2>
          <p className="tenue" style={{ marginTop: 4 }}>
            Active o desactive manzanas cartográficas para ajustar los cálculos de avance y visibilidad en el mapa.
          </p>
        </div>

        <form className="fila" onSubmit={buscar}>
          <label className="campo" style={{ flex: 1, minWidth: 200 }}>
            <span>Código de manzana</span>
            <input
              placeholder="Ej: Z1-014"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
          <button className="boton secundario" style={{ alignSelf: "flex-end" }}>
            <Search size={16} />
            <span>Buscar</span>
          </button>
        </form>

        {manzanas.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            {manzanas.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: 12,
                  borderRadius: "var(--radio-sm)",
                  border: "1px solid var(--linea)",
                  background: "var(--superficie-pura)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <b style={{ display: "block" }}>{m.codigo}</b>
                  <span className={`badge ${m.activa ? "badge-exito" : "badge-aviso"}`} style={{ fontSize: "0.72rem" }}>
                    {m.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <button
                  type="button"
                  className="boton secundario"
                  style={{ minHeight: 30, padding: "2px 8px", fontSize: "0.78rem" }}
                  onClick={() => void alternarManzana(m)}
                >
                  {m.activa ? "Desactivar" : "Activar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
