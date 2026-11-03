"use client";
import { useState, type FormEvent } from "react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";

export default function Ingreso() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const { error: fallo } = await crearClienteNavegador().auth.signInWithPassword({ email: email.trim(), password });
    if (fallo) {
      setError("Correo o contraseña incorrectos");
      setEnviando(false);
      return;
    }
    window.location.assign("/mapa");
  }

  return (
    <main className="ingreso">
      <form className="tarjeta pila" onSubmit={entrar}>
        <h1>Evangelismo IPUC Barrio Dangond</h1>
        <label className="campo"><span>Correo</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="campo"><span>Contraseña</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="boton" disabled={enviando}>{enviando ? "Entrando..." : "Entrar"}</button>
      </form>
    </main>
  );
}
