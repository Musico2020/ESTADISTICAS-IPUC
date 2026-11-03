# Evangelismo IPUC Barrio Dangond

Aplicación web para registrar los reportes de evangelismo, marcar en el mapa las manzanas alcanzadas (verde) o sin predicar (rojo), y generar estadísticas e informes en PDF y Excel.

Usa Next.js y se publica en Vercel. Los datos y usuarios están en Supabase.

## Ejecutarla localmente

1. Copie `.env.example` a `.env.local` y complete las claves del proyecto Supabase.
2. Ejecute `npm install`.
3. Ejecute `npm run dev` y abra http://localhost:3000.

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública. La protección de los datos está en las reglas de la base de datos |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta de servidor. Nunca la publique |
| `CRON_SECRET` | Protege la tarea diaria que evita la pausa de Supabase |

## Preparar la base de datos

```
npx supabase db push
node scripts/cargar-semilla.mjs
node scripts/crear-admin.mjs correo@ejemplo.com Nombre Completo
```

## Pruebas

- `npm test`: lógica del formulario, avance e importación.
- `npm run test:seguridad`: reglas de acceso contra el proyecto Supabase configurado. Crea usuarios y datos temporales y los borra al terminar. Ejecútelas antes de cargar datos reales.

## Cambiar zonas y manzanas

Las zonas están en `data/zonas-pixeles.json` y las calles en `data/vias-osm.json` (datos de OpenStreetMap). Para regenerar:

```
node scripts/generar-manzanas.mjs
node scripts/cargar-semilla.mjs
```

Hágalo antes de cargar reportes reales, porque los códigos de manzana pueden cambiar. Abra `/revision.html` para ver el resultado. Después, use **Administración > Manzanas** para desactivar una manzana errónea.

Para cambiar el color de una zona, edite `color_borde` en `data/zonas-pixeles.json` y regenere.

## Copias de seguridad

El plan gratuito de Supabase no incluye copias descargables. Cada mes, descargue **Informes > Exportar todos los datos** y guárdelo en un lugar privado.
