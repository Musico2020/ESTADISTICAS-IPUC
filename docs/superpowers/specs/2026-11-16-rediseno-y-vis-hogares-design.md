# Rediseño visual y VIS por hogares

Aprobado el 2026-11-16. La maqueta está en `Desktop\VISTA-PREVIA-IPUC\rediseno.html`.

## 1. Rediseño visual (web y app)

- Base azul marino `#0b1b3f` con el dorado del logo `#f5b700`. La letra es Plus Jakarta Sans.
- Cada sección tiene su color de acento:

  | Sección | Color | Código |
  |---|---|---|
  | Evangelismo (mapa, reportes) | azul | `#2563eb` |
  | Cultos | verde | `#059669` |
  | VIS | naranja | `#ea580c` |
  | Amigos | rosa | `#db2777` |
  | Casos | turquesa | `#0891b2` |
  | Estadísticas, informes y administración | violeta | `#7c3aed` |

- **Web:**
  - El acento se define por ruta con `data-seccion` en el contenedor principal, que redefine `--marca`. Los componentes que ya usan `var(--marca)` toman el color de su sección sin cambios.
  - En el computador, el menú pasa a una barra lateral oscura agrupada en Territorio, Iglesia en casas y Análisis, con el perfil y el botón de salir fijos abajo.
  - En el celular, la barra inferior lleva Mapa, Cultos, Registrar, Estadísticas y Más. "Más" abre una hoja con el resto de las opciones.
  - Componentes nuevos:
    - `Contador`: botones − y +.
    - `SiNo`: dos botones en lugar de una casilla.
    - Indicadores con ícono de color.
  - Tablas: avatar con iniciales, etiquetas de color y hover.
  - Los indicadores se muestran de 2 en 2 en el celular.
  - Se arregla el mapa del formulario de culto, que se dibuja mal cuando aún no tiene su tamaño final.
- **App:**
  - Tema propio con la misma paleta.
  - Inicio con encabezado degradado, saludo, rol y zona, resumen de la zona y mosaicos de colores.
  - Formularios por pasos con barra de progreso, contadores − y + y botón fijo abajo.
  - Versión `1.0.1+2`.

## 2. VIS: visitación de hogares

VIS registra el **hogar visitado** con toda su familia, no solo a un niño.

- **Tabla `hogares`:**
  - `zona_id` y `creado_por`.
  - `familia`: nombre de la familia; obligatorio.
  - `direccion`: obligatoria.
  - `lat`, `lon`, `precision_m`, `telefono`.
  - `calamidad`: calamidad o necesidad.
  - `pide_oracion`, `peticion`.
  - `atendio`: quién recibió la visita.
  - `autorizacion_menores`.
  - `estado_seguimiento`, `notas`, `culto_id`.
  - Fechas de creación y actualización.
- **Integrantes:** son filas de `personas` con `tipo = 'integrante'` y `hogar_id`.
  - Cada integrante tiene nombre, edad, parentesco y teléfono, y marca si está enfermo, si pide oración, si entregó su vida y su seguimiento.
  - Al reutilizar `personas`, el mapa, los filtros por situación y los totales los cuentan sin código nuevo.
  - La zona del integrante se copia del hogar.
  - Si un integrante es menor de 18 años, el hogar debe tener `autorizacion_menores` (Ley 1581). La base de datos lo exige con un trigger.
- El tipo `nino_vis` desaparece. Los tipos válidos quedan como `amigo` e `integrante`. No hay datos que migrar.
- **Visitas:** pueden ser a un hogar (`hogar_id`) o a un amigo (`persona_id`), exactamente uno de los dos.
- **Guardado:** `guardar_hogar(p_hogar jsonb, p_integrantes jsonb)` es `security invoker` y guarda el hogar con sus integrantes en una sola transacción, tanto al crear como al corregir. Al corregir, borra a quienes se quitaron.
- **Permisos:**
  - Se mantienen las mismas reglas por jerarquía que `personas`.
  - Quien puede corregir un hogar también puede quitarle integrantes.
  - Borrar un hogar es solo para el administrador.
- **Totales:** `resumen_actividad` agrega `hogares`, `integrantes` y `ninos`, que son los integrantes menores de 18 años. `personas.vis` pasa a contar hogares.

## 3. Pruebas

- Unitarias de validación del hogar en la web y en la app.
- Seguridad (RLS):
  - Un menor sin autorización se rechaza.
  - Otra zona no ve el hogar.
  - El líder no puede quitar integrantes de un hogar ajeno.
- Pruebas e2e en el sitio publicado y de integración de la app con cuentas temporales.
