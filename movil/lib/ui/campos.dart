import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../datos/modelos.dart';

/// Campo de texto con su mensaje de error. Los errores se quitan al escribir (ver alCambiar del formulario).
class Campo extends StatelessWidget {
  const Campo(this.etiqueta, this.control, {super.key, this.error, this.numero = false, this.lineas = 1, this.ayuda, this.alCambiar, this.teclado});
  final String etiqueta;
  final TextEditingController control;
  final String? error;
  final bool numero;
  final int lineas;
  final String? ayuda;
  final VoidCallback? alCambiar;
  final TextInputType? teclado;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: TextField(
          controller: control,
          keyboardType: teclado ?? (numero ? TextInputType.number : (lineas > 1 ? TextInputType.multiline : TextInputType.text)),
          maxLines: lineas,
          onChanged: (_) => alCambiar?.call(),
          decoration: InputDecoration(labelText: etiqueta, hintText: ayuda, errorText: error, border: const OutlineInputBorder()),
        ),
      );
}

class Casilla extends StatelessWidget {
  const Casilla(this.texto, this.valor, this.alCambiar, {super.key});
  final String texto;
  final bool valor;
  final ValueChanged<bool> alCambiar;
  @override
  Widget build(BuildContext context) => CheckboxListTile(
        value: valor,
        onChanged: (v) => alCambiar(v ?? false),
        title: Text(texto),
        contentPadding: EdgeInsets.zero,
        controlAffinity: ListTileControlAffinity.leading,
      );
}

class Seccion extends StatelessWidget {
  const Seccion(this.titulo, this.hijos, {super.key, this.icono});
  final String titulo;
  final List<Widget> hijos;
  final IconData? icono;
  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              if (icono != null) Icon(icono, color: Theme.of(context).colorScheme.primary),
              if (icono != null) const SizedBox(width: 8),
              Expanded(child: Text(titulo, style: Theme.of(context).textTheme.titleMedium)),
            ]),
            const SizedBox(height: 12),
            ...hijos,
          ]),
        ),
      );
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
      return Padding(padding: const EdgeInsets.only(bottom: 14), child: Text('Zona: $nombre', style: const TextStyle(fontWeight: FontWeight.w600)));
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: DropdownButtonFormField<String>(
        initialValue: valor,
        items: [for (final z in zonas) DropdownMenuItem(value: z.id, child: Text(z.nombre))],
        onChanged: alCambiar,
        decoration: InputDecoration(labelText: 'Zona', errorText: error, border: const OutlineInputBorder()),
      ),
    );
  }
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
            decoration: InputDecoration(labelText: etiqueta, errorText: error, border: const OutlineInputBorder(), suffixIcon: const Icon(Icons.calendar_month)),
            child: Text(valor),
          ),
        ),
      );
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
      SnackBar(content: Text(texto), backgroundColor: error ? Colors.red.shade700 : null),
    );
