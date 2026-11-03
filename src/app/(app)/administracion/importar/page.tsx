"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePerfil } from "@/components/ContextoPerfil";
import { traducirFila, type ResultadoFila } from "@/lib/importar/leer";
import { crearClienteNavegador } from "@/lib/supabase/cliente";

const LOTE = 200;
type Fila = Record<string, unknown>;
type Traducida = ResultadoFila & { numero: number };

async function leerArchivo(archivo: File): Promise<Fila[]> {
  if (archivo.name.toLowerCase().endsWith(".csv")) {
    const Papa = (await import("papaparse")).default;
    return new Promise((resolver, rechazar) => {
      Papa.parse<Fila>(archivo, { header: true, skipEmptyLines: true, complete: (r) => resolver(r.data), error: rechazar });
    });
  }
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  const hoja = libro.worksheets[0];
  const encabezados: string[] = [];
  hoja.getRow(1).eachCell((c, n) => { encabezados[n] = c.text; });
  const filas: Fila[] = [];
  hoja.eachRow((fila, n) => {
    if (n === 1) return;
    const f: Fila = {};
    encabezados.forEach((h, i) => {
      if (!h) return;
      const celda = fila.getCell(i);
      f[h] = celda.value instanceof Date ? celda.value : celda.text;
    });
    filas.push(f);
  });
  return filas;
}

export default function PaginaImportar() {
  const perfil = usePerfil();
  const router = useRouter();
  const esAdmin = perfil.rol === "administrador";
  const [filas, setFilas] = useState<Traducida[] | null>(null);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { if (!esAdmin) router.replace("/mapa"); }, [esAdmin, router]);
  if (!esAdmin) return null;

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setError(""); setResultado(""); setFilas(null);
    try {
      const { data: zonas, error: fallo } = await crearClienteNavegador().from("zonas").select("id,numero");
      if (fallo) throw fallo;
      const crudas = await leerArchivo(archivo);
      // La fila 1 del archivo son los encabezados.
      setFilas(await Promise.all(crudas.map(async (f, i) => ({ ...(await traducirFila(f, zonas ?? [])), numero: i + 2 }))));
    } catch {
      setError("No se pudo leer el archivo. Debe ser el CSV o Excel descargado de las respuestas de Google Forms.");
    }
  }

  const validas = (filas ?? []).filter((f): f is Extract<Traducida, { ok: true }> => f.ok);
  const rechazadas = (filas ?? []).filter((f): f is Extract<Traducida, { ok: false }> => !f.ok);
  const advertidas = validas.filter((f) => f.advertencias.length > 0);

  async function importar() {
    setOcupado(true);
    setError("");
    let nuevos = 0;
    try {
      for (let i = 0; i < validas.length; i += LOTE) {
        const lote = validas.slice(i, i + LOTE).map((f) => ({ reporte: f.reporte, casos: f.casos }));
        const { data, error: fallo } = await crearClienteNavegador().rpc("importar_reportes", { p_filas: lote });
        if (fallo) throw fallo;
        nuevos += data as number;
      }
      setResultado(`Se importaron ${nuevos} reportes nuevos. ${validas.length - nuevos} ya estaban en el sistema.`);
    } catch {
      setError(`La importación se interrumpió después de ${nuevos} reportes. Puede subir el archivo de nuevo: los ya importados no se duplican.`);
    }
    setOcupado(false);
  }

  return (
    <div className="pila">
      <h1>Importar desde Google Forms</h1>
      <div className="tarjeta pila">
        <label className="campo"><span>Archivo de respuestas (.csv o .xlsx)</span>
          <input type="file" accept=".csv,.xlsx" onChange={(e) => void elegir(e.target.files?.[0])} />
        </label>
        {error && <p className="aviso" role="alert">{error}</p>}
      </div>
      {filas && (
        <div className="tarjeta pila">
          <h2>Vista previa</h2>
          <p>{validas.length} válidos, {advertidas.length} de ellos con advertencias, y {rechazadas.length} rechazados.</p>
          {rechazadas.map((f) => <p key={f.numero} className="error">Fila {f.numero}: {f.motivo}</p>)}
          {advertidas.map((f) => <p key={f.numero} className="tenue">Fila {f.numero}: {f.advertencias.join("; ")}</p>)}
          {!resultado && <div><button className="boton" disabled={ocupado || validas.length === 0} onClick={() => void importar()}>
            {ocupado ? "Importando..." : `Importar ${validas.length} reportes`}</button></div>}
          {resultado && <p role="status">{resultado} <Link href="/reportes?pendientes=1">Ver pendientes de marcar manzanas</Link></p>}
        </div>
      )}
    </div>
  );
}
