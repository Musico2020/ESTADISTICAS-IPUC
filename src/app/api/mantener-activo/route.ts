import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabase/servicio";

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 401 });
  }
  const { error } = await crearClienteServicio().from("zonas").select("id", { head: true, count: "exact" });
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
