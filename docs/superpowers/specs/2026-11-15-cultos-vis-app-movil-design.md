# Cultos en casas, VIS, amigos y app móvil: diseño

Fecha: 2026-11-15. Estado: aprobado por el usuario.
Amplía `2026-11-03-evangelismo-ipuc-design.md`; lo que no se menciona aquí sigue igual.

## Objetivo

- Registrar desde el celular los cultos en casas (miércoles y viernes), los niños visitados (VIS), los amigos y las jornadas de evangelismo.
- Ver todo en tiempo real en un panel web, con mapa interactivo e informes completos.
- Organizar el territorio en 4 sectores y 12 zonas, con una jerarquía de roles.

## Decisiones del usuario

| Tema | Decisión |
|---|---|
| Territorio | Las 4 áreas actuales son sectores. Cada sector se divide en 3 zonas siguiendo calles, y el usuario revisa la división. |
| Ubicación de una casa | GPS del celular al guardar ("Usar mi ubicación"), más la dirección escrita como referencia. |
| Tiempo real | Los registros nuevos aparecen al instante en mapas y listas. La ubicación se toma solo al guardar; no se rastrea a nadie. |
| App móvil | App nativa en Dart con Flutter, distribuida como `.apk` para Android. |
| Panel web | Se mantiene en Next.js: mapa interactivo, estadísticas, informes y administración. |
| Secciones de la app | Evangelismo (reporte actual), Cultos, VIS y Amigos. |
| Acceso a datos | Por jerarquía, aplicado en la base de datos. Incluye datos de VIS, amigos y ofrendas. |
| Datos de menores | Casilla obligatoria de autorización del acudiente (Ley 1581 de 2012). |

## Roles

| Rol | Alcance | Puede |
|---|---|---|
| `administrador` (superusuario) | Todo | Todo, incluidos usuarios, zonas, eliminar registros, informes e importación |
| `coordinador_sector` | Las 3 zonas de su sector | Ver y corregir todo en su sector; informes de su sector |
| `coordinador_zona` | Su zona | Ver y corregir todo en su zona |
| `lider_zona` | Su zona | Registrar en su zona; ver su zona; corregir lo que registró |

Solo el administrador elimina registros. Las cuentas compartidas (`user`, rol `usuario`) se desactivan, porque cada persona necesita su usuario para saber quién registró cada cosa.

## Territorio

- **`sectores`:** `id`, `numero` (1 a 4), `nombre`, `color_borde`, `geometria`. Salen de las 4 zonas actuales.
- **`zonas`:** `id`, `sector_id`, `numero` (1 a 12), `nombre`, `color_borde`, `geometria`.
- **Manzanas:** se reasignan a la zona que contiene la mayor parte de su área.
- **Cómo se dividen las zonas:** las manzanas de cada sector se agrupan en 3 bloques contiguos de tamaño parecido. Cada zona es la unión de sus manzanas, así que el borde sigue las calles. La propuesta se muestra en el mapa para que el usuario la corrija antes de cargar datos reales.

## Datos nuevos

- **`cultos`:** `id`, `zona_id`, `creado_por`, `fecha`, `dia_semana`, `direccion`, `lat`, `lon`, `precision_m`, `hermanos`, `amigos`, `ninos`, `ofrenda`, `hubo_enfermos`, `se_oro_enfermos`, `observaciones`, fechas de creación y actualización.
- **`personas`:** fichas de niños de VIS y de amigos.
  - Identificación: `id`, `tipo` (`nino_vis` o `amigo`), `zona_id`, `creado_por`, `nombre`.
  - Contacto: `edad`, `telefono`, `direccion`, `lat`, `lon`.
  - Familia y necesidad: `familia` (acudiente y parentesco), `calamidad`, `enfermo`, `pide_oracion`, `peticion`.
  - Seguimiento: `entrego_vida` (se entregó a Cristo), `estado_seguimiento`, `notas`.
  - Origen: `culto_id` o `reporte_id` cuando la persona se conoció en un culto o una jornada.
  - Consentimiento: `autorizacion_acudiente`, obligatoria cuando `tipo = nino_vis`.
- **`visitas`:** cada visita a una persona: `persona_id`, `fecha`, `lat`, `lon`, `notas`, `creado_por`.

Los reportes de evangelismo existentes se mantienen. Su `zona_id` apunta a la zona nueva que contenga sus manzanas.

## Seguridad

- **Funciones de alcance:** `zonas_visibles()` devuelve las zonas que el usuario puede ver según su rol. `puede_corregir(zona_id)` aplica la misma regla para editar. Ambas son `security definer` y se usan en todas las políticas.
- **Row Level Security** en todas las tablas nuevas, con la misma regla de jerarquía para leer, crear y editar. Solo el administrador elimina.
- **Funciones agregadas para el mapa general:** `estado_manzanas` y los conteos siguen entregando solo agregados sin datos personales, para que cualquiera vea el avance sin ver fichas.
- **Tiempo real:** Supabase Realtime sobre `cultos`, `personas`, `visitas` y `reportes`. Realtime respeta RLS, así que cada usuario solo recibe lo que puede ver.
- **Copias de seguridad:** siempre fuera del repositorio, que es público.
- **Contraseñas:** antes de cargar datos reales se cambian las contraseñas de ejemplo por contraseñas largas.

## App móvil (Flutter)

- **Ubicación del código:** carpeta `movil/` en el mismo repositorio.
- **Paquetes:** `supabase_flutter` (sesión, datos y tiempo real), `flutter_map` con OpenStreetMap, `geolocator` (GPS).
- **Ingreso:** con nombre de usuario y contraseña, convertidos al correo interno igual que en la web (`src/lib/usuarios.ts`).
- **Pantallas:** Ingreso; Inicio con Evangelismo, Cultos, VIS y Amigos; un formulario por sección; mapa de su zona; listas de lo registrado.
- **Validaciones:** las mismas reglas que en la web, y la base de datos vuelve a validarlas.
- **Errores:** sin señal no se pierde lo escrito, y se puede reintentar al recuperarla. El modo sin conexión completo queda fuera de esta versión.
- **Distribución:** `.apk` compilado en este equipo. iPhone queda fuera, porque requiere una Mac.

## Panel web (Next.js)

- **Mapa interactivo:**
  - Capas: manzanas, casas con culto, VIS, amigos y bordes de sectores y zonas.
  - Filtros: sector, zona, fechas y tipo.
  - Interacción: fichas al tocar un punto, contadores en vivo y puntos nuevos en tiempo real.
- **Estadísticas e informes:**
  - Temas: evangelismo, cultos (asistencia, amigos, niños, ofrendas, enfermos), VIS y amigos (entregas, enfermos, peticiones de oración, seguimiento).
  - Filtros: sector, zona y período, en PDF y Excel, con listados detallados según permisos.
- **Administración:** usuarios con los 4 roles, sector o zona asignada, y activar o desactivar.

## Fases

0. **Restaurar** el proyecto en Supabase desde la copia del 3 de noviembre y reconectar Vercel.
1. **Territorio y roles:** sectores, 12 zonas, roles y funciones de alcance, con su administración.
2. **Cultos en casas:** registro con GPS en la web y tiempo real.
3. **VIS y amigos:** fichas, visitas y consentimiento.
4. **Mapa interactivo** con capas, filtros y tiempo real.
5. **Informes completos.**
6. **App móvil en Flutter** y `.apk`.

Cada fase termina publicada y probada antes de seguir con la siguiente.

## Pruebas

- **Seguridad:** pruebas de RLS por cada rol y tabla. Un líder no lee ni escribe fuera de su zona, un coordinador de sector no ve otros sectores y nadie salvo el administrador elimina.
- **Lógica:** Vitest para validaciones y cálculos en la web; pruebas de Dart para los formularios de la app.
- **De punta a punta:** registrar desde la app o la web y ver el punto aparecer en vivo en el panel de otro usuario con permiso.
