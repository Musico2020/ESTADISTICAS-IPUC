import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../datos/modelos.dart';

/// Campo de texto con su mensaje de error. Los errores se quitan al escribir (ver alCambiar del formulario).
class Campo extends StatelessWidget {
  const Campo(this.etiqueta, this.control, {super.key, this.error, this.numero = false, this.lineas = 1, this.ayuda, this.alCambiar, this.teclado, this.icono});
  final String etiqueta;
  final TextEditingController control;
  final String? error;
  final bool numero;
  final int lineas;
  final String? ayuda;
  final VoidCallback? alCambiar;
  final TextInputType? teclado;
  final IconData? icono;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: TextField(
          controller: control,
          keyboardType: teclado ?? (numero ? TextInputType.number : (lineas > 1 ? TextInputType.multiline : TextInputType.text)),
          textCapitalization: numero || teclado == TextInputType.phone ? TextCapitalization.none : TextCapitalization.sentences,
          maxLines: lineas,
          onChanged: (_) => alCambiar?.call(),
          decoration: InputDecoration(labelText: etiqueta, hintText: ayuda, errorText: error, prefixIcon: icono == null ? null : Icon(icono)),
        ),
      );
}

/// Etiqueta pequeña en negrita sobre un control.
class Etiqueta extends StatelessWidget {
  const Etiqueta(this.texto, {super.key});
  final String texto;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(texto, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
      );
}

/// Número entero con botones − y + grandes. El valor vive en un TextEditingController para poder escribirlo.
class Contador extends StatelessWidget {
  const Contador(this.etiqueta, this.control, {super.key, this.error, this.alCambiar});
  final String etiqueta;
  final TextEditingController control;
  final String? error;
  final VoidCallback? alCambiar;

  int get _n => int.tryParse(control.text.trim()) ?? 0;
  void _poner(int v) {
    control.text = '${v < 0 ? 0 : v}';
    alCambiar?.call();
  }

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    final borde = error == null ? const Color(0xFFCFD5E3) : Theme.of(context).colorScheme.error;
    Widget boton(String signo, String nombre, VoidCallback? accion) => Semantics(
          button: true,
          label: '$nombre a $etiqueta',
          child: Material(
            color: color.withValues(alpha: 0.10),
            child: InkWell(
              onTap: accion,
              child: SizedBox(width: 58, height: 54, child: Center(child: Text(signo, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: accion == null ? color.withValues(alpha: 0.35) : color)))),
            ),
          ),
        );
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Etiqueta(etiqueta),
        ListenableBuilder(
          listenable: control,
          builder: (context, _) => Container(
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: borde, width: 1.5), color: Theme.of(context).colorScheme.surface),
            clipBehavior: Clip.antiAlias,
            child: Row(children: [
              boton('−', 'Restar uno', _n > 0 ? () => _poner(_n - 1) : null),
              Expanded(
                child: TextField(
                  controller: control,
                  textAlign: TextAlign.center,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)],
                  onChanged: (_) => alCambiar?.call(),
                  style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800),
                  decoration: InputDecoration(
                    hintText: '0', filled: false, isDense: true, semanticCounterText: etiqueta,
                    border: InputBorder.none, enabledBorder: InputBorder.none, focusedBorder: InputBorder.none, errorBorder: InputBorder.none,
                  ),
                ),
              ),
              boton('+', 'Sumar uno', () => _poner(_n + 1)),
            ]),
          ),
        ),
        if (error != null) Padding(padding: const EdgeInsets.only(top: 6, left: 4), child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12.5))),
      ]),
    );
  }
}

/// Pregunta de sí o no con dos botones grandes.
class SiNo extends StatelessWidget {
  const SiNo(this.pregunta, this.valor, this.alCambiar, {super.key});
  final String pregunta;
  final bool valor;
  final ValueChanged<bool> alCambiar;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    Widget opcion(String texto, bool v) {
      final activo = valor == v;
      return Expanded(
        child: Semantics(
          button: true,
          selected: activo,
          label: '$pregunta: $texto',
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => alCambiar(v),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              height: 50,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: activo ? color.withValues(alpha: 0.12) : Theme.of(context).colorScheme.surface,
                border: Border.all(color: activo ? color : const Color(0xFFCFD5E3), width: activo ? 2 : 1.5),
              ),
              child: Text(texto, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: activo ? color : const Color(0xFF64708A))),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Etiqueta(pregunta),
        Row(children: [opcion('Sí', true), const SizedBox(width: 10), opcion('No', false)]),
      ]),
    );
  }
}

class Casilla extends StatelessWidget {
  const Casilla(this.texto, this.valor, this.alCambiar, {super.key});
  final String texto;
  final bool valor;
  final ValueChanged<bool> alCambiar;
  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: valor ? color.withValues(alpha: 0.08) : null,
        border: Border.all(color: valor ? color : const Color(0xFFCFD5E3), width: 1.5),
      ),
      child: CheckboxListTile(
        value: valor,
        onChanged: (v) => alCambiar(v ?? false),
        title: Text(texto, style: const TextStyle(fontWeight: FontWeight.w600)),
        controlAffinity: ListTileControlAffinity.leading,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

/// Tarjeta de un bloque del formulario, con ícono o número de paso en el color de la sección.
class Seccion extends StatelessWidget {
  const Seccion(this.titulo, this.hijos, {super.key, this.icono, this.detalle});
  final String titulo;
  final List<Widget> hijos;
  final IconData? icono;
  final String? detalle;
  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            if (icono != null)
              Container(
                width: 36, height: 36, margin: const EdgeInsets.only(right: 10),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(11)),
                child: Icon(icono, color: color, size: 20),
              ),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(titulo, style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800)),
                if (detalle != null) Text(detalle!, style: const TextStyle(fontSize: 12.5, color: Color(0xFF64708A))),
              ]),
            ),
          ]),
          const SizedBox(height: 14),
          ...hijos,
        ]),
      ),
    );
  }
}

/// Aviso de una línea con ícono, en verde (listo) o naranja (atención).
class Aviso extends StatelessWidget {
  const Aviso(this.texto, {super.key, this.bien = true});
  final String texto;
  final bool bien;
  @override
  Widget build(BuildContext context) {
    final color = bien ? const Color(0xFF059669) : const Color(0xFFD97706);
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Icon(bien ? Icons.check_circle : Icons.info, color: color, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Text(texto, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 13))),
      ]),
    );
  }
}

/// Selector de zona para quien maneja varias; para los demás muestra su zona fija.
class SelectorZona extends StatelessWidget {
  const SelectorZona({super.key, required this.zonas, required this.valor, required this.puedeElegir, required this.alCambiar, this.error});
  final List<Zona> zonas;
  final String? valor;
  final bool puedeElegir;
  final ValueChanged<String?> alCambiar;
  final String? error;

  @override
  Widget build(BuildContext context) {
    if (!puedeElegir) {
      final nombre = zonas.where((z) => z.id == valor).map((z) => z.nombre).firstOrNull ?? '...';
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: InputDecorator(decoration: const InputDecoration(labelText: 'Zona', prefixIcon: Icon(Icons.layers)), child: Text(nombre, style: const TextStyle(fontWeight: FontWeight.w700))),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: DropdownButtonFormField<String>(
        initialValue: valor,
        items: [for (final z in zonas) DropdownMenuItem(value: z.id, child: Text(z.nombre))],
        onChanged: alCambiar,
        decoration: InputDecoration(labelText: 'Zona', errorText: error, prefixIcon: const Icon(Icons.layers)),
      ),
    );
  }
}

/// Lista desplegable de textos fijos (parentesco, seguimiento...).
class Desplegable extends StatelessWidget {
  const Desplegable(this.etiqueta, this.valor, this.opciones, this.alCambiar, {super.key, this.error});
  final String etiqueta;
  final String? valor;
  final Map<String, String> opciones;
  final ValueChanged<String?> alCambiar;
  final String? error;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: DropdownButtonFormField<String>(
          initialValue: valor == null || valor!.isEmpty ? null : valor,
          items: [for (final o in opciones.entries) DropdownMenuItem(value: o.key, child: Text(o.value))],
          onChanged: alCambiar,
          decoration: InputDecoration(labelText: etiqueta, errorText: error),
        ),
      );
}

class SelectorFecha extends StatelessWidget {
  const SelectorFecha({super.key, required this.etiqueta, required this.valor, required this.alCambiar, this.error});
  final String etiqueta;
  final String valor;
  final ValueChanged<String> alCambiar;
  final String? error;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () async {
            final elegida = await showDatePicker(
              context: context,
              initialDate: DateTime.tryParse(valor) ?? DateTime.now(),
              firstDate: DateTime(2024),
              lastDate: DateTime.now(),
            );
            if (elegida != null) alCambiar(elegida.toIso8601String().substring(0, 10));
          },
          child: InputDecorator(
            decoration: InputDecoration(labelText: etiqueta, errorText: error, prefixIcon: const Icon(Icons.calendar_month)),
            child: Text(valor, style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        ),
      );
}

/// Botón de GPS con el estado de la ubicación debajo.
class BotonUbicacion extends StatelessWidget {
  const BotonUbicacion({super.key, required this.buscando, required this.ubicacion, required this.alTocar, this.precision, this.error, this.opcional = false});
  final bool buscando;
  final LatLng? ubicacion;
  final int? precision;
  final VoidCallback alTocar;
  final String? error;
  final bool opcional;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        FilledButton.icon(
          onPressed: buscando ? null : alTocar,
          icon: const Icon(Icons.my_location),
          label: Text(buscando ? 'Buscando ubicación...' : opcional ? 'Usar mi ubicación (opcional)' : 'Usar mi ubicación'),
        ),
        if (ubicacion != null)
          Aviso('Ubicada: ${ubicacion!.latitude.toStringAsFixed(5)}, ${ubicacion!.longitude.toStringAsFixed(5)}${precision == null ? '' : ' · ±$precision m'}')
        else
          const Padding(padding: EdgeInsets.only(top: 8), child: Text('Estando en la casa, toque el botón. También puede tocar el mapa para marcar el punto.', style: TextStyle(color: Color(0xFF64708A)))),
        if (error != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
        const SizedBox(height: 10),
      ]);
}

/// Pide la ubicación una sola vez; no sigue a nadie.
Future<(LatLng?, int?, String?)> ubicacionActual() async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) return (null, null, 'Active el GPS del celular e intente de nuevo.');
    var permiso = await Geolocator.checkPermission();
    if (permiso == LocationPermission.denied) permiso = await Geolocator.requestPermission();
    if (permiso == LocationPermission.denied || permiso == LocationPermission.deniedForever) {
      return (null, null, 'Sin permiso de ubicación. Puede marcar la casa tocando el mapa.');
    }
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)),
    );
    return (LatLng(pos.latitude, pos.longitude), pos.accuracy.round(), null);
  } catch (_) {
    return (null, null, 'No se pudo obtener la ubicación. Marque la casa tocando el mapa.');
  }
}

void avisar(BuildContext context, String texto, {bool error = false}) => ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(texto), backgroundColor: error ? Colors.red.shade700 : const Color(0xFF0B1B3F)),
    );
