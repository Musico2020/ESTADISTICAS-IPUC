"use client";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { User, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { aCorreo } from "@/lib/usuarios";

export default function Ingreso() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarClave, setMostrarClave] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const { error: fallo } = await crearClienteNavegador().auth.signInWithPassword({
      email: aCorreo(usuario),
      password,
    });
    if (fallo) {
      setError("Usuario o contraseña incorrectos");
      setEnviando(false);
      return;
    }
    window.location.assign("/mapa");
  }

  return (
    <main className="ingreso-envoltura">
      <div className="ingreso-circulo-decorativo" aria-hidden="true" />
      
      <div className="ingreso-tarjeta">
        <div className="ingreso-logo-contenedor">
          <Image src="/logo-ipuc.png" alt="Logo de la Iglesia Pentecostal Unida de Colombia" width={220} height={155} priority unoptimized
            style={{ background: "#ffffff", borderRadius: 12, padding: 8, height: "auto", maxWidth: "100%" }} />
          <div>
            <h1 style={{ fontSize: "1.45rem", justifyContent: "center", marginBottom: 4 }}>
              Evangelismo IPUC
            </h1>
            <p className="tenue" style={{ fontSize: "0.88rem" }}>
              Barrio Dangond · Valledupar
            </p>
          </div>
        </div>

        <form className="pila" onSubmit={entrar}>
          <div className="campo">
            <span>
              <User size={16} /> Usuario
            </span>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              placeholder="Escriba su usuario"
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </div>

          <div className="campo">
            <span>
              <Lock size={16} /> Contraseña
            </span>
            <div style={{ position: "relative" }}>
              <input
                type={mostrarClave ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setMostrarClave(!mostrarClave)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--tenue)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: 4,
                }}
                title={mostrarClave ? "Ocultar" : "Mostrar"}
              >
                {mostrarClave ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="aviso" style={{ background: "var(--peligro-fondo)", borderColor: "var(--peligro-borde)", color: "var(--peligro-texto)" }} role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0, color: "var(--peligro)" }} />
              <span>{error}</span>
            </div>
          )}

          <button className="boton" disabled={enviando} style={{ width: "100%", marginTop: 8 }}>
            {enviando ? (
              <>
                <Loader2 size={18} className="girar" />
                <span>Ingresando...</span>
              </>
            ) : (
              <>
                <span>Iniciar sesión</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid var(--linea)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <ShieldCheck size={16} style={{ color: "var(--exito)" }} />
          <span style={{ fontSize: "0.8rem", color: "var(--tenue)" }}>
            Acceso seguro para coordinadores
          </span>
        </div>
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
    </main>
  );
}
