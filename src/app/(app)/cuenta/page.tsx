"use client";
import { useState, type FormEvent } from "react";
import { usePerfil } from "@/components/ContextoPerfil";
import { crearClienteNavegador } from "@/lib/supabase/cliente";

export default function PaginaCuenta() {
  const perfil = usePerfil();
  const [nueva, setNueva] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cambiar(e: FormEvent) {
    e.preventDefault();
    if (nueva.length < 8) { setMensaje("La contraseña debe tener al menos 8 caracteres."); return; }
    const { error } = await crearClienteNavegador().auth.updateUser({ password: nueva });
    setMensaje(error ? "No se pudo cambiar la contraseña." : "Contraseña actualizada.");
    if (!error) setNueva("");
  }

  return (
    <div className="pila">
      <h1>Mi cuenta</h1>
      <p>{perfil.nombre_completo} · {perfil.rol === "administrador" ? "Administrador" : "Coordinador"}</p>
      <form className="tarjeta pila" onSubmit={cambiar}>
        <label className="campo"><span>Nueva contraseña</span>
          <input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </label>
        {mensaje && <p role="status">{mensaje}</p>}
        <div><button className="boton">Cambiar contraseña</button></div>
      </form>
    </div>
  );
}
