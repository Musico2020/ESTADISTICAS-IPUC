# Programa de evangelismo IPUC Barrio Dangond: diseño

Fecha: 2026-11-03. Estado: pendiente de revisión.

## Objetivo

Reemplazar el Google Form "Reporte de Evangelismo y Misiones de Zona, IPUC Barrio Dangond 2026" por una aplicación web que:

- registre los reportes de cada jornada en una base de datos;
- muestre en un mapa las manzanas alcanzadas (verde) y sin predicar (rojo);
- genere estadísticas e informes en PDF y Excel.

## Fuera de alcance

Funcionamiento sin conexión, notificaciones, ubicación por GPS y registro de personas como fichas independientes.

## Arquitectura

| Parte | Tecnología |
|---|---|
| Aplicación web | Next.js con TypeScript, adaptada a celular |
| Publicación | Vercel |
| Base de datos y usuarios | Supabase (PostgreSQL, Auth, Row Level Security) |
| Mapa | Leaflet con mapa base de OpenStreetMap |
| Gráficas | Recharts |
| Informes | jsPDF para PDF y ExcelJS para Excel, generados en el navegador |

La geometría de zonas y manzanas se guarda como GeoJSON en columnas `jsonb`. No se usa PostGIS porque la aplicación no hace consultas espaciales en la base de datos.

## Roles

| Permiso | Coordinador | Administrador |
|---|---|---|
| Crear reportes | Solo de su zona | De cualquier zona |
| Editar reportes | Los que creó | Todos |
| Eliminar reportes | No | Sí |
| Ver el mapa y las cifras agregadas | Todas las zonas | Todas las zonas |
| Ver el detalle de reportes y casos especiales | Solo de su zona | Todas las zonas |
| Generar informes en PDF y Excel | No | Sí |
| Gestionar usuarios e importar datos | No | Sí |

- Cada coordinador pertenece a una sola zona. Una zona puede tener varios coordinadores.
- El ingreso es con correo y contraseña. No hay registro público: el administrador crea las cuentas desde una ruta de servidor que usa la clave de servicio de Supabase. Esa clave nunca llega al navegador.

## Modelo de datos

- **`zonas`**: `id`, `numero` (1 a 4), `nombre`, `color_borde`, `geometria`.
- **`manzanas`**: `id`, `zona_id`, `codigo` (por ejemplo, `Z1-014`), `geometria`, `activa`.
- **`perfiles`**: `id` (usuario de Auth), `nombre_completo`, `rol` (`coordinador` o `administrador`), `zona_id` (obligatorio para coordinadores), `activo`.
- **`reportes`**:
  - Datos generales: `id`, `zona_id`, `creado_por`, `responsable_nombre`, `coordinador_nombre`, `fecha_jornada`.
  - Cobertura: `direccion`, `hogares_visitados`, `personas_contactadas`, `personas_aceptan_visita`, `nombres_visita`, `resultado_espiritual`.
  - Niños: `evangelismo_ninos` (sí o no), `ninos_alcanzados`.
  - Evaluación: `receptividad` (1 a 5), `dificultad`, `dificultad_otra`, `sugerencias`.
  - Control: `origen` (`app` o `google_forms`), `huella_importacion` (única), `manzanas_pendientes`, fechas de creación y actualización.
- **`reporte_manzanas`**: `reporte_id`, `manzana_id` (clave compuesta).
- **`casos_especiales`**: `id`, `reporte_id`, `zona_id`, `tipo` (`enfermo`, `sordo` o `consejeria`), `descripcion`, `estado` (`pendiente` o `atendido`), `atendido_en`.

Los números de un reporte hecho en la aplicación son obligatorios y no negativos. En los importados pueden quedar vacíos si el dato original no es un número.

## Cambios frente al Google Form

| Campo | Google Form | Aplicación |
|---|---|---|
| Hogares visitados | Opciones de 1 a 5 | Número libre |
| Personas que aceptaron visita | Párrafo | Cantidad (`personas_aceptan_visita`) y nombres opcionales (`nombres_visita`) |
| Descripción del caso | Obligatoria siempre | Obligatoria solo si hay un "Sí" en casos especiales |
| Niños alcanzados | Obligatorio siempre | Obligatorio solo si se hizo evangelismo a niños |
| Manzanas trabajadas | Dirección escrita | Selección en el mapa (al menos una) y dirección escrita opcional |
| Coordinador de zona | Escrito a mano | Sugerido a partir del usuario, editable |

El formulario conserva una sola descripción. Por cada "Sí" en casos especiales se crea una fila en `casos_especiales` con esa descripción.

## Seguridad de los datos

Row Level Security está activo en todas las tablas:

- `reportes`, `reporte_manzanas` y `casos_especiales`: el coordinador solo accede a las filas de su zona y el administrador a todas.
- Las escrituras de un coordinador deben corresponder a su zona, y el campo `zona_id` lo valida la base de datos.
- `perfiles`: cada usuario ve el suyo y el administrador todos.
- `zonas` y `manzanas`: lectura para cualquier usuario activo y escritura solo para el administrador.
- Dos funciones `security definer` entregan lo que todos pueden ver, sin datos personales ni texto libre:
  - `estado_manzanas(desde, hasta)`: manzana, última fecha trabajada y número de jornadas.
  - `estadisticas(desde, hasta, zona)`: solo totales y agrupaciones.

## Mapa

**Estado de una manzana.** Es verde si tiene al menos un reporte dentro del período elegido y roja en caso contrario. El período por defecto es el año en curso, por lo que el mapa de cada año nuevo empieza en rojo. Se puede filtrar por año o por rango de fechas. El avance es manzanas verdes sobre manzanas activas, por zona y en total.

**Colores de las zonas.** El relleno solo indica el estado. El borde indica la zona, con esta asignación provisional, que el usuario debe confirmar: Zona 1 amarillo, Zona 2 morado, Zona 3 rojo, Zona 4 verde. El borde rojo de la Zona 3 se dibuja más grueso que los de manzana, para no confundirlo con "sin predicar".

**Generación de manzanas.** Se hace una sola vez con un script:

1. Se trazan las 4 zonas sobre OpenStreetMap, siguiendo la imagen entregada por el usuario.
2. Se descargan las vías del sector desde Overpass, sin senderos ni ciclorrutas.
3. Se convierten las vías en polígonos con Turf y se asigna cada polígono a la zona que contiene su centro.
4. Se descartan los polígonos con área fuera de un rango razonable y se cargan a `manzanas`.

**Revisión.** Se entrega un mapa de revisión con los códigos de manzana para que alguien que conozca el barrio lo valide. El administrador puede desactivar una manzana errónea. Las correcciones de forma se hacen ajustando los datos y volviendo a ejecutar el script antes de cargar reportes reales. La generación desde OpenStreetMap se comprueba en el primer paso de la construcción. Si no sirve, se detiene y se consulta al usuario antes de cambiar de método.

## Pantallas

1. **Ingreso**: correo y contraseña.
2. **Nuevo reporte**: las secciones del formulario y el mapa de la zona para tocar las manzanas.
3. **Mapa**: avance por zona y total, filtro de fechas y, al tocar una manzana, su código, última fecha y número de jornadas.
4. **Estadísticas**: totales de hogares, personas, niños y visitas aceptadas; receptividad promedio; dificultades; avance y jornadas por zona y por mes.
5. **Reportes**: lista y detalle según el rol, con edición según los permisos.
6. **Casos especiales**: lista filtrable y cambio de estado entre pendiente y atendido.
7. **Informes** (administrador): PDF con cifras, gráficas y avance por zona; Excel con el detalle completo. Se filtran por zona y fechas. Los casos especiales solo se incluyen si el administrador marca esa opción.
8. **Administración**: usuarios e importación.

## Importación desde Google Forms

- El administrador sube el archivo de respuestas en CSV o XLSX y ve una vista previa antes de confirmar.
- Las columnas se identifican por el texto de la pregunta, ignorando mayúsculas y espacios sobrantes.
- `Zona N` se asigna a la zona correspondiente. Las filas con zona o fecha inválidas no se importan y se listan con el motivo.
- Los campos numéricos que no sean números quedan vacíos y se marcan para revisión. El texto de "Personas que aceptaron visita" se guarda en `nombres_visita`, y si es solo un número pasa a `personas_aceptan_visita`.
- Cada "Sí" en casos especiales crea su fila en `casos_especiales`.
- Los reportes entran con `origen = google_forms` y `manzanas_pendientes = true`. Cuentan en las estadísticas, pero no en el mapa, hasta que alguien marque sus manzanas. Una lista muestra los pendientes.
- `huella_importacion` es un resumen de la marca temporal, el nombre y la fecha, para evitar duplicados si se sube dos veces el mismo archivo.

## Operación

- **Secretos**: las claves van en variables de entorno de Vercel y nunca en el repositorio ni en el chat. El usuario inicia sesión en las herramientas de Supabase y Vercel desde su navegador.
- **Pausa de Supabase**: una tarea programada de Vercel hace una consulta diaria mínima para evitar la pausa por inactividad del plan gratuito. La ruta exige un secreto.
- **Copias de seguridad**: el plan gratuito no incluye copias automáticas descargables. El administrador tiene un botón para exportar todos los datos a Excel, y se recomienda usarlo cada mes.

## Manejo de errores

- Los formularios validan en el navegador y de nuevo en la base de datos, con mensajes en español.
- Si se pierde la conexión al enviar un reporte, el formulario conserva lo escrito y permite reintentar.
- Un reporte y sus manzanas y casos se guardan en una sola transacción, por medio de una función de base de datos, para no dejar reportes incompletos.

## Pruebas

- **Lógica**: pruebas con Vitest para la lectura del archivo importado, las reglas del formulario y el cálculo de avance.
- **Seguridad**: pruebas de integración con usuarios de prueba, antes de cargar datos reales, que confirman que un coordinador no puede leer ni escribir datos de otra zona y que `estado_manzanas` y `estadisticas` no exponen texto libre. Los usuarios y datos de prueba se borran al terminar.
- **De punta a punta**: en el sitio publicado, crear un reporte desde un tamaño de celular, ver la manzana en verde, ver las cifras actualizadas y descargar el PDF y el Excel.

## Pendientes del usuario

- Confirmar qué color corresponde a cada zona.
- Entregar el archivo de respuestas de Google Forms.
- Tener cuentas en Supabase y Vercel e iniciar sesión cuando se le pida.
- Designar a una persona que conozca el barrio para validar las manzanas.
