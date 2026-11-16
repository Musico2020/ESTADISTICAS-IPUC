# App móvil Evangelismo IPUC (Flutter)

App de Android para los líderes y coordinadores. Usa la misma base de datos de Supabase que el sitio web. Lo que se registra aquí aparece al instante en el panel web.

## Qué hace

- Ingreso con usuario y contraseña, los mismos del sitio web.
- **Culto en casa:** ubicación con el GPS del celular, asistencia, ofrenda y enfermos.
- **VIS:** ficha del niño con la autorización obligatoria del acudiente.
- **Amigo:** entregas, enfermos y peticiones de oración.
- **Evangelismo:** jornada por manzanas, tocándolas en el mapa.
- **Mapa de mi zona:** manzanas, cultos y fichas, con avisos en tiempo real.

Cada persona ve y registra solo dentro de su alcance. Esa regla la aplica la base de datos, no la app.

## Compilar el `.apk`

Desde la raíz del repositorio:

```
node scripts/compilar-apk.mjs
```

El script toma la URL y la clave pública de Supabase de `.env.local` y deja el archivo `Evangelismo-IPUC-<versión>.apk` en el Escritorio. Antes de compilar una actualización, suba la versión en `pubspec.yaml`, por ejemplo de `1.0.0+1` a `1.0.1+2`.

### Llave de firma

Android solo instala una actualización si está firmada con la misma llave que la versión anterior. La llave **no está en el repositorio**. Vive en `C:\Users\Usuario\Desktop\LLAVES-APP-IPUC`, y `movil/android/key.properties` apunta a ella. Haga una copia de esa carpeta en un lugar seguro: si se pierde, los celulares no aceptarán nuevas versiones.

## Pruebas

```
cd movil
flutter test test/reglas_test.dart test/ingreso_test.dart
```

Las pruebas de integración contra Supabase crean y borran cuentas temporales. Se ejecutan desde la raíz:

```
node scripts/probar-movil.mjs
```
