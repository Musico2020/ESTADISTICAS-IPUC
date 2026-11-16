"use client";
import type { ReactNode } from "react";

// Número entero con botones − y +. Deja escribir directamente; vacío equivale a "".
export function Contador({ nombre, valor, alCambiar, max = 9999, etiqueta }: {
  nombre: string; valor: string; alCambiar: (v: string) => void; max?: number; etiqueta: string;
}) {
  const n = /^\d+$/.test(valor) ? +valor : 0;
  return (
    <div className="contador">
      <button type="button" aria-label={`Restar uno a ${etiqueta}`} disabled={n <= 0} onClick={() => alCambiar(String(Math.max(0, n - 1)))}>−</button>
      <input name={nombre} inputMode="numeric" aria-label={etiqueta} value={valor} placeholder="0"
        onChange={(e) => alCambiar(e.target.value.replace(/[^\d]/g, "").slice(0, String(max).length))} />
      <button type="button" aria-label={`Sumar uno a ${etiqueta}`} disabled={n >= max} onClick={() => alCambiar(String(Math.min(max, n + 1)))}>+</button>
    </div>
  );
}

// Pregunta de sí o no con dos botones grandes.
export function SiNo({ valor, alCambiar, etiqueta }: { valor: boolean; alCambiar: (v: boolean) => void; etiqueta: string }) {
  return (
    <div className="sino" role="group" aria-label={etiqueta}>
      <button type="button" aria-pressed={valor} onClick={() => alCambiar(true)}>Sí</button>
      <button type="button" aria-pressed={!valor} onClick={() => alCambiar(false)}>No</button>
    </div>
  );
}

// Encabezado de un paso numerado dentro de un formulario.
export function Paso({ numero, titulo, detalle }: { numero: number; titulo: string; detalle?: ReactNode }) {
  return (
    <h2 className="paso">
      <span className="paso-numero">{numero}</span>
      <span>{titulo}{detalle && <small>{detalle}</small>}</span>
    </h2>
  );
}

// Etiqueta de campo con error debajo.
export function Campo({ etiqueta, error, icono, children }: { etiqueta: string; error?: string; icono?: ReactNode; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{icono} {etiqueta}</span>
      {children}
      {error && <span className="error" role="alert">{error}</span>}
    </label>
  );
}
