"use client";
import { useState, type FormEvent } from "react";
import {
  User,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { usePerfil } from "@/components/ContextoPerfil";
import { crearClienteNavegador } from "@/lib/supabase/cliente";

export default function PaginaCuenta() {
  const perfil = usePerfil();
  const [nueva, setNueva] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cambiar(e: FormEvent) {
    e.preventDefault();
    if (nueva.length < 8) {
      setMensaje("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setGuardando(true);
    const { error } = await crearClienteNavegador().auth.updateUser({ password: nueva });
    setGuardando(false);
    setMensaje(error ? "No se pudo cambiar la contraseña. Intente de nuevo." : "Contraseña actualizada exitosamente.");
    if (!error) setNueva("");
  }

  const iniciales = perfil.nombre_completo
    ? perfil.nombre_completo
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("")
    : "U";

  const esExito = mensaje.includes("exitosamente");

  return (
    <div className="pila">
      {/* Encabezado */}
      <div>
        <h1>
          <User size={28} style={{ color: "var(--marca)" }} />
          <span>Mi Cuenta de Usuario</span>
        </h1>
        <p className="tenue">
          Detalles del perfil de usuario y configuración de seguridad
        </p>
      </div>

      {/* Tarjeta de Perfil */}
      <div className="tarjeta" style={{ display: "flex", alignItems: "center", gap: 18, background: "var(--superficie-pura)" }}>
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "var(--marca-degradado)",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "1.3rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--marca-sombra)",
            flexShrink: 0,
          }}
        >
          {iniciales}
        </div>
        <div>
          <b style={{ fontSize: "1.2rem", display: "block", marginBottom: 4 }}>
            {perfil.nombre_completo}
          </b>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span className={`badge ${perfil.rol === "administrador" ? "badge-marca" : "badge-tenue"}`}>
              <ShieldCheck size={13} />
              <span>{perfil.rol === "administrador" ? "Administrador General" : "Coordinador de Zona"}</span>
            </span>
            <span className="badge badge-exito">
              <span className="punto-estado punto-exito" />
              <span>Cuenta activa</span>
            </span>
          </div>
        </div>
      </div>

      {/* Formulario de Cambio de Contraseña */}
      <form className="tarjeta pila" onSubmit={cambiar}>
        <h2>
          <KeyRound size={20} style={{ color: "var(--marca)" }} />
          <span>Actualizar contraseña</span>
        </h2>
        <p className="tenue">
          Establezca una nueva clave de acceso personal para ingresar al sistema de estadísticas.
        </p>

        <div className="campo" style={{ maxWidth: 420 }}>
          <span>
            <Lock size={15} /> Nueva contraseña (mínimo 8 caracteres)
          </span>
          <div style={{ position: "relative" }}>
            <input
              type={mostrar ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setMostrar(!mostrar)}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--tenue)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
              title={mostrar ? "Ocultar" : "Mostrar"}
            >
              {mostrar ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {mensaje && (
          <div
            className="aviso"
            style={{
              background: esExito ? "var(--exito-fondo)" : "var(--aviso-fondo)",
              borderColor: esExito ? "var(--exito-borde)" : "var(--aviso-borde)",
              color: esExito ? "var(--exito)" : "var(--aviso-texto)",
              maxWidth: 420,
            }}
            role="status"
          >
            {esExito ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{mensaje}</span>
          </div>
        )}

        <div>
          <button className="boton" disabled={guardando || !nueva}>
            {guardando ? "Actualizando..." : "Guardar nueva contraseña"}
          </button>
        </div>
      </form>
    </div>
  );
}
