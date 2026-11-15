import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
dotenv.config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const srv = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const creados: string[] = [];

async function usuario(rol: string, zona_id: string | null, sector_id: string | null = null) {
  const email = `prueba-${randomUUID()}@example.com`, password = randomUUID();
  const { data, error } = await srv.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  creados.push(data.user.id);
  const r = await srv.from("perfiles").insert({ id: data.user.id, nombre_completo: "Prueba", rol, zona_id, sector_id });
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

let z1: string, z2: string, zVecina: string, s1: string, s2: string, m1: string, m2: string, mVecina: string;
let c1: SupabaseClient, c2: SupabaseClient, admin: SupabaseClient, reporteZ1: string;

beforeAll(async () => {
  const { data: zonas } = await srv.from("zonas").select("id,numero,sector_id").order("numero");
  // z1 y zVecina están en el sector 1; z2 en el sector 2.
  const zn = (n: number) => zonas!.find((z) => z.numero === n)!;
  z1 = zn(1).id; zVecina = zn(2).id; z2 = zn(4).id; s1 = zn(1).sector_id; s2 = zn(4).sector_id;
  const pick = async (z: string) => (await srv.from("manzanas").select("id").eq("zona_id", z).limit(1).single()).data!.id;
  m1 = await pick(z1); m2 = await pick(z2); mVecina = await pick(zVecina);
  c1 = (await usuario("lider_zona", z1)).c;
  c2 = (await usuario("lider_zona", z2)).c;
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
    expect((await srv.from("perfiles").select("rol").eq("id", yo).single()).data!.rol).toBe("lider_zona");
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
    const { c, id } = await usuario("lider_zona", z1);
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

describe("jerarquía de sectores y zonas", () => {
  it("un líder no ve la zona vecina aunque sea de su mismo sector", async () => {
    const { c } = await usuario("lider_zona", zVecina);
    expect((await c.from("reportes").select("id").eq("id", reporteZ1)).data).toEqual([]);
    const r = await c.rpc("guardar_reporte", { p_id: null, p_reporte: base(z1), p_manzanas: [m1], p_casos: [] });
    expect(r.error).not.toBeNull();
  });
  it("un líder no corrige el reporte de otro líder de su zona", async () => {
    const { c } = await usuario("lider_zona", z1);
    const r = await c.rpc("guardar_reporte", { p_id: reporteZ1, p_reporte: base(z1), p_manzanas: [m1], p_casos: [] });
    expect(r.error).not.toBeNull();
  });
  it("el coordinador de zona ve y corrige los reportes de su zona", async () => {
    const { c } = await usuario("coordinador_zona", z1);
    expect((await c.from("casos_especiales").select("id").eq("reporte_id", reporteZ1)).data).toHaveLength(1);
    const r = await c.rpc("guardar_reporte", { p_id: reporteZ1, p_reporte: base(z1), p_manzanas: [m1], p_casos: [{ tipo: "enfermo", descripcion: "CASO-SECRETO" }] });
    expect(r.error).toBeNull();
  });
  it("el coordinador de zona no ve otra zona", async () => {
    const { c } = await usuario("coordinador_zona", zVecina);
    expect((await c.from("casos_especiales").select("id").eq("reporte_id", reporteZ1)).data).toEqual([]);
  });
  it("el coordinador de sector ve y corrige en las zonas de su sector", async () => {
    const { c } = await usuario("coordinador_sector", null, s1);
    expect((await c.from("reportes").select("id").eq("id", reporteZ1)).data).toHaveLength(1);
    const r = await c.rpc("guardar_reporte", { p_id: null, p_reporte: base(zVecina), p_manzanas: [mVecina], p_casos: [] });
    expect(r.error).toBeNull();
  });
  it("el coordinador de sector no ve otro sector", async () => {
    const { c } = await usuario("coordinador_sector", null, s2);
    expect((await c.from("reportes").select("id").eq("id", reporteZ1)).data).toEqual([]);
    expect((await c.from("casos_especiales").select("id").eq("reporte_id", reporteZ1)).data).toEqual([]);
    const r = await c.rpc("guardar_reporte", { p_id: reporteZ1, p_reporte: base(z1), p_manzanas: [m1], p_casos: [] });
    expect(r.error).not.toBeNull();
  });
  it("ningún coordinador elimina reportes", async () => {
    const { c } = await usuario("coordinador_sector", null, s1);
    await c.from("reportes").delete().eq("id", reporteZ1);
    expect((await srv.from("reportes").select("id").eq("id", reporteZ1)).data).toHaveLength(1);
  });
  it("un perfil sin su sector o zona se rechaza", async () => {
    const { data } = await srv.auth.admin.createUser({ email: `prueba-${randomUUID()}@example.com`, password: randomUUID(), email_confirm: true });
    creados.push(data.user!.id);
    expect((await srv.from("perfiles").insert({ id: data.user!.id, nombre_completo: "X", rol: "coordinador_sector" })).error).not.toBeNull();
    expect((await srv.from("perfiles").insert({ id: data.user!.id, nombre_completo: "X", rol: "lider_zona" })).error).not.toBeNull();
  });
});

describe("cultos en casas", () => {
  const culto = (zona_id: string) => ({ zona_id, fecha: "2099-01-20", direccion: "DIRECCION-SECRETA", lat: 10.46, lon: -73.25,
    hermanos: 5, amigos: 2, ninos: 1, ofrenda: 20000, hubo_enfermos: true, se_oro_enfermos: true });
  let lider: SupabaseClient, cultoZ1: string;
  beforeAll(async () => {
    lider = (await usuario("lider_zona", z1)).c;
    const r = await lider.from("cultos").insert(culto(z1)).select("id").single();
    if (r.error) throw r.error;
    cultoZ1 = r.data.id;
  });
  afterAll(async () => { await srv.from("cultos").delete().eq("fecha", "2099-01-20"); });
  it("un líder registra en su zona y no en otra", async () => {
    expect((await lider.from("cultos").insert(culto(zVecina))).error).not.toBeNull();
  });
  it("otra zona no ve el culto ni su ofrenda", async () => {
    const { c } = await usuario("lider_zona", zVecina);
    expect((await c.from("cultos").select("id").eq("id", cultoZ1)).data).toEqual([]);
  });
  it("el coordinador de sector lo ve y lo corrige; el de otro sector no", async () => {
    const a = (await usuario("coordinador_sector", null, s1)).c;
    expect((await a.from("cultos").update({ hermanos: 6 }).eq("id", cultoZ1).select("hermanos")).data).toEqual([{ hermanos: 6 }]);
    const b = (await usuario("coordinador_sector", null, s2)).c;
    expect((await b.from("cultos").select("id").eq("id", cultoZ1)).data).toEqual([]);
    expect((await b.from("cultos").update({ hermanos: 99 }).eq("id", cultoZ1).select("id")).data).toEqual([]);
  });
  it("otro líder de la misma zona no lo corrige", async () => {
    const { c } = await usuario("lider_zona", z1);
    expect((await c.from("cultos").update({ hermanos: 99 }).eq("id", cultoZ1).select("id")).data).toEqual([]);
  });
  it("al corregir no se puede cambiar el autor", async () => {
    const yo = (await lider.auth.getUser()).data.user!.id;
    await lider.from("cultos").update({ creado_por: "00000000-0000-0000-0000-000000000000", hermanos: 7 }).eq("id", cultoZ1);
    expect((await srv.from("cultos").select("creado_por").eq("id", cultoZ1).single()).data!.creado_por).toBe(yo);
  });
  it("nadie salvo el administrador elimina", async () => {
    await lider.from("cultos").delete().eq("id", cultoZ1);
    expect((await srv.from("cultos").select("id").eq("id", cultoZ1)).data).toHaveLength(1);
  });
  it("un visitante sin sesión no lee cultos", async () => {
    const a = createClient(URL, ANON, { auth: { persistSession: false } });
    expect((await a.from("cultos").select("id")).data ?? []).toEqual([]);
  });
});

describe("VIS, amigos y visitas", () => {
  const ninoFicha = (zona_id: string, c: Record<string, unknown> = {}) => ({ tipo: "nino_vis", zona_id, nombre: "NINO-SECRETO", edad: 8,
    acudiente: "Madre", autorizacion_acudiente: true, telefono: "3001234567", calamidad: "CALAMIDAD-SECRETA", ...c });
  let lider: SupabaseClient, ninoZ1: string;
  beforeAll(async () => {
    lider = (await usuario("lider_zona", z1)).c;
    const r = await lider.from("personas").insert(ninoFicha(z1)).select("id").single();
    if (r.error) throw r.error;
    ninoZ1 = r.data.id;
  });
  afterAll(async () => { await srv.from("personas").delete().in("nombre", ["NINO-SECRETO", "AMIGO-SECRETO"]); });
  it("sin autorización del acudiente la base de datos rechaza la ficha", async () => {
    expect((await lider.from("personas").insert(ninoFicha(z1, { autorizacion_acudiente: false }))).error).not.toBeNull();
    expect((await lider.from("personas").insert(ninoFicha(z1, { edad: 19 }))).error).not.toBeNull();
    expect((await lider.from("personas").insert(ninoFicha(z1, { acudiente: null }))).error).not.toBeNull();
  });
  it("otra zona no ve la ficha del niño ni sus visitas", async () => {
    await lider.from("visitas").insert({ persona_id: ninoZ1, zona_id: z1, fecha: "2099-03-01", notas: "VISITA-SECRETA" });
    const { c } = await usuario("lider_zona", zVecina);
    expect((await c.from("personas").select("id").eq("id", ninoZ1)).data).toEqual([]);
    expect((await c.from("visitas").select("id").eq("persona_id", ninoZ1)).data).toEqual([]);
  });
  it("no se puede colar una visita en otra zona cambiando su zona", async () => {
    const { c } = await usuario("lider_zona", zVecina);
    const r = await c.from("visitas").insert({ persona_id: ninoZ1, zona_id: zVecina, fecha: "2099-03-02" });
    expect(r.error).not.toBeNull();
  });
  it("el coordinador de sector ve la ficha; el de otro sector no", async () => {
    const a = (await usuario("coordinador_sector", null, s1)).c;
    expect((await a.from("personas").select("calamidad").eq("id", ninoZ1)).data).toEqual([{ calamidad: "CALAMIDAD-SECRETA" }]);
    const b = (await usuario("coordinador_sector", null, s2)).c;
    expect((await b.from("personas").select("id").eq("id", ninoZ1)).data).toEqual([]);
  });
  it("otro líder de la zona registra visitas pero no corrige la ficha ajena", async () => {
    const { c } = await usuario("lider_zona", z1);
    expect((await c.from("visitas").insert({ persona_id: ninoZ1, zona_id: z1, fecha: "2099-03-03" })).error).toBeNull();
    expect((await c.from("personas").update({ nombre: "CAMBIADO" }).eq("id", ninoZ1).select("id")).data).toEqual([]);
  });
  it("solo el administrador elimina fichas", async () => {
    await lider.from("personas").delete().eq("id", ninoZ1);
    expect((await srv.from("personas").select("id").eq("id", ninoZ1)).data).toHaveLength(1);
  });
  it("las funciones agregadas no exponen nombres de personas", async () => {
    const { c } = await usuario("lider_zona", zVecina);
    const r = await c.rpc("estadisticas", { p_desde: "2099-01-01", p_hasta: "2099-12-31" });
    expect(JSON.stringify(r.data)).not.toMatch(/NINO-SECRETO|CALAMIDAD-SECRETA/);
  });
});

describe("resumen de actividad", () => {
  let lider: SupabaseClient;
  beforeAll(async () => {
    lider = (await usuario("lider_zona", z1)).c;
    const c = await lider.from("cultos").insert({ zona_id: z1, fecha: "2099-04-04", direccion: "RESUMEN-SECRETO", lat: 10.46, lon: -73.25, hermanos: 7, amigos: 2, ninos: 1, ofrenda: 30000 });
    if (c.error) throw c.error;
    const p = await lider.from("personas").insert({ tipo: "amigo", zona_id: z1, nombre: "PERSONA-RESUMEN", entrego_vida: true });
    if (p.error) throw p.error;
  });
  afterAll(async () => {
    await srv.from("cultos").delete().eq("direccion", "RESUMEN-SECRETO");
    await srv.from("personas").delete().eq("nombre", "PERSONA-RESUMEN");
  });
  const resumen = (c: SupabaseClient) => c.rpc("resumen_actividad", { p_desde: "2099-01-01", p_hasta: "2099-12-31" });
  it("el líder suma su zona y no expone nombres ni direcciones", async () => {
    const r = await resumen(lider);
    expect(r.error).toBeNull();
    expect(r.data.cultos).toMatchObject({ total: 1, hermanos: 7, ofrenda: 30000 });
    expect(JSON.stringify(r.data)).not.toMatch(/RESUMEN-SECRETO|PERSONA-RESUMEN/);
  });
  it("otra zona y otro sector suman cero", async () => {
    const vecino = (await usuario("lider_zona", zVecina)).c;
    expect((await resumen(vecino)).data.cultos.total).toBe(0);
    const otro = (await usuario("coordinador_sector", null, s2)).c;
    const r = await resumen(otro);
    expect(r.data.cultos.total).toBe(0);
    expect(r.data.por_zona.map((z: { numero: number }) => z.numero)).toEqual([4, 5, 6]);
  });
  it("el coordinador del sector lo suma, y la entrega cuenta", async () => {
    const c = (await usuario("coordinador_sector", null, s1)).c;
    // La ficha se registra hoy, así que el rango debe incluir la fecha actual.
    const r = await c.rpc("resumen_actividad", { p_desde: "2000-01-01", p_hasta: "2099-12-31" });
    expect(r.data.cultos.total).toBeGreaterThanOrEqual(1);
    expect(r.data.personas.entregaron).toBeGreaterThanOrEqual(1);
  });
  it("un visitante sin sesión no puede llamarlo", async () => {
    const a = createClient(URL, ANON, { auth: { persistSession: false } });
    expect((await resumen(a)).error).not.toBeNull();
  });
});
