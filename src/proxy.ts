import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await db.auth.getUser();
  const enIngreso = request.nextUrl.pathname.startsWith("/ingreso");
  if (!user && !enIngreso) return NextResponse.redirect(new URL("/ingreso", request.url));
  if (user && enIngreso) return NextResponse.redirect(new URL("/mapa", request.url));
  return respuesta;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/mantener-activo|revision.html).*)"] };
