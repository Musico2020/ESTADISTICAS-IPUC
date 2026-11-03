import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
dotenv.config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const srv = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const creados: string[] = [];

async function usuario(rol: string, zona_id: string | null) {
  const email = `prueba-${randomUUID()}@example.com`, password = randomUUID();
  const { data, error } = await srv.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  creados.push(data.user.id);
  const r = await srv.from("perfiles").insert({ id: data.user.id, nombre_completo: "Prueba", rol, zona_id });
  if (r.error) throw r.error;
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  return { c, id: data.user.id };
}

const base = (zona_id: string) => ({
  zona_id, responsable_nombre: "R", coordinador_nombre: "C", fecha_jornada: "2099-01-15",
  hogares_visitados: 3, personas_contactadas: 5, personas_aceptan_visita: 1, nombres_visita: "NOMBRE-SECRETO",
  resultado_espiritual: "TEXTO-SECRETO", evangelismo_ninos: false, receptividad: 4, dificultad: "ninguna",
});

let z1: string, z2: string, m1: string, m2: string;
let c1: SupabaseClient, c2: SupabaseClient, admin: SupabaseClient, reporteZ1: string;

beforeAll(async () => {
  const { data: zonas } = await srv.from("zonas").select("id,numero").order("numero");
  z1 = zonas![0].id; z2 = zonas![1].id;
  const pick = async (z: string) => (await srv.from("manzanas").select("id").eq("zona_id", z).limit(1).single()).data!.id;
  m1 = await pick(z1); m2 = await pick(z2);
  c1 = (await usuario("coordinador", z1)).c;
  c2 = (await usuario("coordinador", z2)).c;
  admin = (await usuario("administrador", null)).c;
  const r = await c1.rpc("guardar_reporte", { p_id: null, p_reporte: base(z1), p_manzanas: [m1],
    p_casos: [{ tipo: "enfermo", descripcion: "CASO-SECRETO" }] });
  if (r.error) throw r.error;
  reporteZ1 = r.data;
});

afterAll(async () => {
  await srv.from("reportes").delete().gte("fecha_jornada", "2099-01-01");
  await Promise.all(creados.map((id) => srv.auth.admin.deleteUser(id)));
});

describe("aislamiento por zona", () => {
  it("el coordinador de otra zona no ve el reporte", async () => {
    expect((await c2.from("reportes").select("id").eq("id", reporteZ1)).data).toEqual([]);
  });
  it("el coordinador de otra zona no ve el caso especial", async () => {
    expect((await c2.from("casos_especiales").select("id").eq("reporte_id", reporteZ1)).data).toEqual([]);
  });
  it("el coordinador de la zona y el administrador sí lo ven", async () => {
    expect((await c1.from("reportes").select("id").eq("id", reporteZ1)).data).toHaveLength(1);
    expect((await admin.from("casos_especiales").select("id").eq("reporte_id", reporteZ1)).data).toHaveLength(1);
  });
  it("un coordinador no puede crear reportes en otra zona", async () => {
    const r = await c2.rpc("guardar_reporte", { p_id: null, p_reporte: base(z1), p_manzanas: [m1], p_casos: [] });
    expect(r.error).not.toBeNull();
  });
  it("no se pueden marcar manzanas de otra zona", async () => {
    const r = await c1.rpc("guardar_reporte", { p_id: null, p_reporte: base(z1), p_manzanas: [m2], p_casos: [] });
    expect(r.error).not.toBeNull();
  });
  it("un coordinador no puede editar reportes de otra zona", async () => {
    const r = await c2.rpc("guardar_reporte", { p_id: reporteZ1, p_reporte: base(z1), p_manzanas: [m1], p_casos: [] });
    expect(r.error).not.toBeNull();
  });
  it("un coordinador no puede eliminar reportes", async () => {
    await c1.from("reportes").delete().eq("id", reporteZ1);
    expect((await srv.from("reportes").select("id").eq("id", reporteZ1)).data).toHaveLength(1);
  });
});

describe("escalada de privilegios", () => {
  it("un coordinador no puede volverse administrador", async () => {
    const yo = (await c1.auth.getUser()).data.user!.id;
    await c1.from("perfiles").update({ rol: "administrador" }).eq("id", yo);
    expect((await srv.from("perfiles").select("rol").eq("id", yo).single()).data!.rol).toBe("coordinador");
  });
  it("un coordinador no puede importar", async () => {
    expect((await c1.rpc("importar_reportes", { p_filas: [] })).error).not.toBeNull();
  });
});

describe("funciones agregadas", () => {
  it("estadisticas no expone texto libre a otra zona", async () => {
    const r = await c2.rpc("estadisticas", { p_desde: "2099-01-01", p_hasta: "2099-12-31" });
    expect(r.error).toBeNull();
    expect(r.data.totales.jornadas).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(r.data)).not.toMatch(/SECRETO/);
  });
  it("estado_manzanas muestra la manzana sin datos personales", async () => {
    const r = await c2.rpc("estado_manzanas", { p_desde: "2099-01-01", p_hasta: "2099-12-31" });
    expect(r.data!.map((x: { manzana_id: string }) => x.manzana_id)).toContain(m1);
    expect(JSON.stringify(r.data)).not.toMatch(/SECRETO/);
  });
  it("un visitante sin sesión no puede leer nada", async () => {
    const a = createClient(URL, ANON, { auth: { persistSession: false } });
    expect((await a.rpc("estadisticas", { p_desde: "2099-01-01", p_hasta: "2099-12-31" })).error).not.toBeNull();
    expect((await a.from("reportes").select("id")).data ?? []).toEqual([]);
    expect((await a.from("manzanas").select("id")).data ?? []).toEqual([]);
  });
  it("un usuario desactivado pierde el acceso", async () => {
    const { c, id } = await usuario("coordinador", z1);
    await srv.from("perfiles").update({ activo: false }).eq("id", id);
    expect((await c.from("reportes").select("id").eq("id", reporteZ1)).data).toEqual([]);
    expect((await c.rpc("estado_manzanas", { p_desde: "2099-01-01", p_hasta: "2099-12-31" })).error).not.toBeNull();
  });
});

describe("rol usuario (todas las zonas)", () => {
  let u: SupabaseClient, reporteU: string;
  beforeAll(async () => {
    u = (await usuario("usuario", null)).c;
    const r = await u.rpc("guardar_reporte", { p_id: null, p_reporte: base(z2), p_manzanas: [m2], p_casos: [] });
    if (r.error) throw r.error;
    reporteU = r.data;
  });
  it("ve reportes y casos de cualquier zona", async () => {
    expect((await u.from("reportes").select("id").eq("id", reporteZ1)).data).toHaveLength(1);
    expect((await u.from("casos_especiales").select("id").eq("reporte_id", reporteZ1)).data).toHaveLength(1);
  });
  it("reporta en cualquier zona y edita lo suyo", async () => {
    const r = await u.rpc("guardar_reporte", { p_id: null, p_reporte: base(z1), p_manzanas: [m1], p_casos: [] });
    expect(r.error).toBeNull();
    const e = await u.rpc("guardar_reporte", { p_id: reporteU, p_reporte: base(z2), p_manzanas: [m2], p_casos: [] });
    expect(e.error).toBeNull();
  });
  it("no edita reportes de otra persona", async () => {
    const r = await u.rpc("guardar_reporte", { p_id: reporteZ1, p_reporte: base(z1), p_manzanas: [m1], p_casos: [] });
    expect(r.error).not.toBeNull();
  });
  it("no marca una manzana que no sea de la zona del reporte", async () => {
    const r = await u.rpc("guardar_reporte", { p_id: null, p_reporte: base(z1), p_manzanas: [m2], p_casos: [] });
    expect(r.error).not.toBeNull();
  });
  it("no elimina reportes", async () => {
    await u.from("reportes").delete().eq("id", reporteZ1);
    expect((await srv.from("reportes").select("id").eq("id", reporteZ1)).data).toHaveLength(1);
  });
  it("no se vuelve administrador ni ve otros perfiles", async () => {
    const yo = (await u.auth.getUser()).data.user!.id;
    await u.from("perfiles").update({ rol: "administrador" }).eq("id", yo);
    expect((await srv.from("perfiles").select("rol").eq("id", yo).single()).data!.rol).toBe("usuario");
    const p = (await u.from("perfiles").select("id")).data!;
    expect(p.map((x: { id: string }) => x.id)).toEqual([yo]);
  });
  it("no importa ni cambia manzanas", async () => {
    expect((await u.rpc("importar_reportes", { p_filas: [] })).error).not.toBeNull();
    await u.from("manzanas").update({ activa: false }).eq("id", m1);
    expect((await srv.from("manzanas").select("activa").eq("id", m1).single()).data!.activa).toBe(true);
  });
});
